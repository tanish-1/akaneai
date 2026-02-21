import { useRef, useEffect, useState, Suspense, Component } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import AVATAR_PLAYLIST from './avatarPlaylist';

useGLTF.setDecoderPath('/draco/');

// ─── Normalise playlist ───────────────────────────────────────────────────────
// Each entry can be a plain string or { url, label } — normalise to objects.
const MODEL_PLAYLIST = AVATAR_PLAYLIST.map(entry =>
    typeof entry === 'string' ? { url: entry, label: entry.split('/').pop() } : entry
);
MODEL_PLAYLIST.forEach(({ url }) => useGLTF.preload(url));

// ─── Talking / active animation ──────────────────────────────────────────────
// This model plays (looping) whenever the AI is speaking or thinking.
// It overrides the idle playlist and resumes it when the AI goes quiet.
const TALKING_URL = '/models/talking.glb';
useGLTF.preload(TALKING_URL);

// ─── Bone patterns ────────────────────────────────────────────────────────────
const BONE_PATTERNS = {
    hips: ['Hips_01', 'Hips', 'hips', 'pelvis', 'Root'],
    spine: ['Spine_02', 'Spine', 'spine', 'Spine1'],
    chest: ['Chest_03', 'Chest', 'chest', 'Spine2', 'UpperChest'],
    neck: ['Neck_04', 'Neck', 'neck'],
    head: ['Head_05', 'Head', 'head'],
    leftArm: ['UpperArm_L_072', 'LeftArm', 'mixamorigLeftArm'],
    rightArm: ['UpperArm_R', 'RightArm', 'mixamorigRightArm'],
    leftForeArm: ['LowerArm_L_073', 'LeftForeArm', 'mixamorigLeftForeArm'],
    rightForeArm: ['LowerArm_R', 'RightForeArm', 'mixamorigRightForeArm'],
    leftHand: ['Hand_L_075', 'LeftHand', 'mixamorigLeftHand'],
    rightHand: ['Hand_R', 'RightHand', 'mixamorigRightHand'],
};

function findBones(scene) {
    const allBones = {};
    scene.traverse(obj => {
        if (obj.name) allBones[obj.name] = obj;
        if (obj.isSkinnedMesh && obj.skeleton) {
            obj.skeleton.bones.forEach(b => { if (b.name) allBones[b.name] = b; });
        }
    });
    const allNames = Object.keys(allBones);
    function fuzzyFind(patterns) {
        for (const p of patterns) { if (allBones[p]) return allBones[p]; }
        for (const p of patterns) {
            const pl = p.toLowerCase();
            for (const name of allNames) {
                const s = name.replace(/_\d+$/, '').toLowerCase();
                if (s.includes(pl) || pl.includes(s)) return allBones[name];
            }
        }
        return null;
    }
    const bones = {};
    for (const [key, patterns] of Object.entries(BONE_PATTERNS)) {
        const found = fuzzyFind(patterns);
        if (found) bones[key] = found;
    }
    return bones;
}

// ─── Procedural overlays ──────────────────────────────────────────────────────
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
function addRot(bone, x, y, z) {
    if (!bone) return;
    _e.set(x, y, z, 'XYZ'); _q.setFromEuler(_e);
    bone.quaternion.multiply(_q);
}
function setRot(bone, x, y, z) {
    if (!bone) return;
    _e.set(x, y, z, 'XYZ'); bone.quaternion.setFromEuler(_e);
}

function overlayTalk(b, t) {
    const nod = Math.sin(t * 4.5) * 0.07;
    if (b.head) setRot(b.head, nod, Math.sin(t * 2.1) * 0.08, 0);
    if (b.neck) setRot(b.neck, nod * 0.3, 0, 0);
    const g = Math.sin(t * 3) * 0.25;
    if (b.leftHand) setRot(b.leftHand, 0, 0, g * 0.3);
    if (b.rightHand) setRot(b.rightHand, 0, 0, -g * 0.3);
}
function overlayListen(b, t) {
    const tilt = 0.08 + Math.sin(t * 0.7) * 0.02;
    if (b.head) setRot(b.head, 0, 0, tilt);
    if (b.neck) setRot(b.neck, -0.05, 0, tilt * 0.3);
}
function overlayThink(b, t) {
    const nod = Math.sin(t * 0.9) * 0.03;
    if (b.head) setRot(b.head, 0.05 + nod, Math.sin(t * 0.6) * 0.07, 0.12);
    if (b.rightArm) setRot(b.rightArm, -0.45, 0, -0.4);
    if (b.rightForeArm) setRot(b.rightForeArm, 1.3, 0, 0);
    if (b.leftArm) setRot(b.leftArm, 0.15, 0, 0.3);
    if (b.leftForeArm) setRot(b.leftForeArm, 0.8, 0, 0);
}
function overlayIdle(b, t) {
    if (b.head) setRot(b.head, Math.sin(t * 0.5) * 0.02, Math.sin(t * 0.7) * 0.03, 0);
}
const OVERLAYS = { idle: overlayIdle, listening: overlayListen, thinking: overlayThink, talking: overlayTalk };

function SingleAnimatedModel({ url, avatarStateRef, onBonesReady, onFinished, speed = 1.0, loopRepeat = false }) {
    const group = useRef();
    const [scaled, setScaled] = useState(false); // hide model until positioned

    const { scene, animations } = useGLTF(url);
    const { actions, mixer } = useAnimations(animations, group);

    // ── Step 1: fix materials ─────────────────────────────────────────────────
    useEffect(() => {
        scene.traverse(child => {
            if (!child.isMesh) return;
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(mat => {
                if (!mat) return;
                if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
                mat.depthWrite = true;
                if (mat.transparent) { mat.alphaTest = 0.5; mat.side = THREE.DoubleSide; }
                mat.needsUpdate = true;
            });
        });
    }, [scene]);

    // ── Step 2: auto-scale, THEN show model, THEN start animation ─────────────
    useEffect(() => {
        // small delay so Three.js has rendered one frame and we can measure the bbox
        const t = setTimeout(() => {
            if (!group.current) return;

            const box = new THREE.Box3().setFromObject(group.current);
            const size = new THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 0) {
                const scale = 2.0 / maxDim;
                group.current.scale.setScalar(scale);
                // Pin the BOTTOM of the model (feet) to y = -1.4.
                // Using box.min.y (not center.y) so the offset doesn't double-count.
                // World feet Y = group.position.y + box.min.y * scale = -1.4
                group.current.position.y = -(box.min.y * scale) - 1.4;
            }

            // Find bones now that it's positioned
            onBonesReady(findBones(scene));

            // Make model visible now that it's properly positioned
            setScaled(true);
        }, 80);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene]); // run only when scene changes (i.e. on mount)

    // ── Step 3: play animation once scaled is true ────────────────────────────
    useEffect(() => {
        if (!scaled || !mixer) return;

        const animName = Object.keys(actions)[0];
        const action = animName ? actions[animName] : null;
        console.log(`[Akane Avatar] ▶ Playing [${url}] → "${animName}"`);

        if (!action) {
            // No animation — move on
            return;
        }

        action.reset().play();
        if (loopRepeat) {
            // Talking/thinking model: loop forever, no onFinished
            action.setLoop(THREE.LoopRepeat, Infinity);
        } else {
            // Playlist model: play once then advance
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;

            const onDone = () => {
                console.log(`[Akane Avatar] ✅ Done: ${url}`);
                if (onFinished) onFinished();
            };
            mixer.addEventListener('finished', onDone);
            return () => {
                mixer.removeEventListener('finished', onDone);
                action.stop();
            };
        }
        // We intentionally only re-run this when `scaled` flips to true.
        // `actions` / `mixer` are stable for the lifetime of this component instance.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scaled]);

    // Per-frame: adjust mixer speed
    useFrame(() => {
        if (!mixer) return;
        const s = avatarStateRef.current;
        const stateScale = s === 'talking' ? 1.4 : s === 'thinking' ? 0.6 : s === 'listening' ? 0.85 : 1.0;
        mixer.timeScale = stateScale * speed;
    });

    // model is invisible (no render geometry contribution) until scaled is set
    return (
        <group ref={group} visible={scaled}>
            <primitive object={scene} />
        </group>
    );
}

// ─── Per-model error boundary ─────────────────────────────────────────────────
// Keyed to playlistIndex in AvatarModel so it resets on every model switch.
// If a model throws during render, catches it, logs it, and renders nothing
// (the playlist will naturally advance after the frame since the model's
// onFinished won't fire — for hard crashes we just skip that model).
class ModelErrorBoundary extends Component {
    constructor(props) { super(props); this.state = { hasError: false, errMsg: '' }; }
    static getDerivedStateFromError(e) { return { hasError: true, errMsg: e.message }; }
    componentDidCatch(e) { console.error('[Akane Avatar] Model render error:', e.message); }
    render() {
        if (this.state.hasError) {
            console.warn('[Akane Avatar] Skipping broken model, will auto-advance...');
            return null; // invisible — playlist will keep going via timeout fallback
        }
        return this.props.children;
    }
}

// ─── AvatarModel: playlist manager ───────────────────────────────────────────
function AvatarModel({ avatarState, isTaskFound, onBehaviorLabel }) {
    const [playlistIndex, setPlaylistIndex] = useState(0);
    const avatarStateRef = useRef(avatarState);
    const bonesRef = useRef({});
    const groupRef = useRef();
    const switchingRef = useRef(false); // guard against double-fire

    useEffect(() => { avatarStateRef.current = avatarState; }, [avatarState]);

    // Is the AI actively speaking, thinking, or listening?
    const isActive = avatarState === 'talking' || avatarState === 'thinking' || avatarState === 'listening';

    // UPDATED: Use talking animation for ALL speech/thought/listening
    const showTalkingModel = isActive;

    useEffect(() => {
        const labels = { idle: '💭 Idle...', listening: '👂 Listening...', thinking: '🤔 Thinking...', talking: '💬 Talking...' };
        const modelNum = playlistIndex + 1;
        // Label still highlights when a 'task focus' is found for visual confirmation
        const suffix = (isActive && isTaskFound) ? ' [task focus]' : ` [${modelNum}/${MODEL_PLAYLIST.length}]`;
        onBehaviorLabel?.(`${labels[avatarState] ?? '💭 Idle...'}${suffix}`);
    }, [avatarState, onBehaviorLabel, playlistIndex, isActive, isTaskFound]);

    const handleBonesReady = (bones) => { bonesRef.current = bones; };

    // ── THE EVOLUTION TRIGGER: Cycle look AFTER finishes speaking ────────────────
    useEffect(() => {
        // If we just finished talking/thinking AND a task was found...
        if (!isActive && isTaskFound && !switchingRef.current) {
            console.log('✨ [Evolution] Dialogue finished, updating Akane-chan\'s appearance...');
            switchingRef.current = true;
            setPlaylistIndex(prev => (prev + 1) % MODEL_PLAYLIST.length);
            // reset guard after a delay
            setTimeout(() => { switchingRef.current = false; }, 1000);
        }
    }, [isActive, isTaskFound]);

    // Procedural overlays + float bob — runs every frame regardless of which model
    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        const b = bonesRef.current;
        if (b && Object.keys(b).length > 0) {
            const overlay = OVERLAYS[avatarStateRef.current] || OVERLAYS.idle;
            overlay(b, t);
        }
        if (groupRef.current) {
            const baseY = groupRef.current.userData.baseY ?? groupRef.current.position.y;
            groupRef.current.userData.baseY = baseY;
            groupRef.current.position.y = baseY + Math.sin(t * 1.2) * 0.005;
        }
    });

    const { url: currentUrl, label: currentLabel, speed: currentSpeed = 1.0 } = MODEL_PLAYLIST[playlistIndex];

    return (
        <group ref={groupRef}>
            {showTalkingModel ? (
                // ── Talking / thinking: loop talking.glb until AI goes quiet ──
                <ModelErrorBoundary key="boundary-talking">
                    <SingleAnimatedModel
                        key="model-talking"
                        url={TALKING_URL}
                        avatarStateRef={avatarStateRef}
                        onBonesReady={handleBonesReady}
                        loopRepeat={true}
                    />
                </ModelErrorBoundary>
            ) : (
                // ── Idle / listening / Standard Talk: play playlist model ────────────────
                <ModelErrorBoundary key={`boundary-${playlistIndex}`}>
                    <SingleAnimatedModel
                        key={`model-${playlistIndex}`}
                        url={currentUrl}
                        avatarStateRef={avatarStateRef}
                        onBonesReady={handleBonesReady}
                        onFinished={() => setPlaylistIndex(prev => (prev + 1) % MODEL_PLAYLIST.length)}
                        speed={currentSpeed}
                        loopRepeat={false}
                    />
                </ModelErrorBoundary>
            )}
        </group>
    );
}

// ─── Background rings ─────────────────────────────────────────────────────────
function BackgroundRings({ avatarState }) {
    const r1 = useRef(), r2 = useRef(), r3 = useRef();
    const stateRef = useRef(avatarState);
    useEffect(() => { stateRef.current = avatarState; }, [avatarState]);
    useFrame(({ clock }, delta) => {
        const t = clock.elapsedTime;
        const s = stateRef.current;
        const speed = s === 'talking' ? 1.6 : s === 'thinking' ? 1.0 : 0.4;
        if (r1.current) { r1.current.rotation.z += delta * speed; r1.current.scale.setScalar(1 + Math.sin(t * 2) * 0.03); }
        if (r2.current) r2.current.rotation.z -= delta * speed * 0.6;
        if (r3.current) { r3.current.rotation.x += delta * speed * 0.35; r3.current.rotation.z += delta * speed * 0.25; }
    });
    const color = avatarState === 'thinking' ? '#9f7aea' : avatarState === 'listening' ? '#68d391' : '#63b3ed';
    return (
        <group position={[0, 0.2, -1.2]}>
            <mesh ref={r1}><torusGeometry args={[2.1, 0.013, 8, 128]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} transparent opacity={0.55} /></mesh>
            <mesh ref={r2} rotation={[0, 0, Math.PI / 4]}><torusGeometry args={[2.45, 0.009, 8, 128]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} transparent opacity={0.32} /></mesh>
            <mesh ref={r3} rotation={[Math.PI / 3, 0, 0]}><torusGeometry args={[1.8, 0.007, 8, 100]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} transparent opacity={0.22} /></mesh>
        </group>
    );
}

function LoadingSpinner() {
    const ref = useRef();
    useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * 2; });
    return <group ref={ref}><mesh><torusKnotGeometry args={[0.5, 0.15, 128, 32]} /><meshStandardMaterial color="#63b3ed" emissive="#63b3ed" emissiveIntensity={0.6} wireframe /></mesh></group>;
}

class AvatarErrorBoundary extends Component {
    constructor(props) { super(props); this.state = { hasError: false }; }
    static getDerivedStateFromError() { return { hasError: true }; }
    componentDidCatch(e) { console.error('[Avatar] Error:', e.message); }
    render() {
        if (this.state.hasError) return <mesh><sphereGeometry args={[0.5, 32, 32]} /><meshStandardMaterial color="#fc8181" emissive="#fc8181" emissiveIntensity={0.4} wireframe /></mesh>;
        return this.props.children;
    }
}

// ─── Scene fog — fades 3D edges into background depth ────────────────────────
function FogEffect() {
    const { scene } = THREE;
    useEffect(() => { }, []); // placeholder so we can use useThree
    return null;
}

// ─── Glowing floor platform — matches the circular cyan platform in the BG ───
function GlowPlatform() {
    const ref = useRef();
    useFrame(({ clock }) => {
        if (ref.current) {
            ref.current.material.emissiveIntensity = 0.6 + Math.sin(clock.elapsedTime * 1.5) * 0.15;
        }
    });
    return (
        <group position={[0, -1.54, 0]}>
            {/* Main glow disc */}
            <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.9, 64]} />
                <meshStandardMaterial
                    color="#003344"
                    emissive="#00c8ff"
                    emissiveIntensity={0.7}
                    transparent
                    opacity={0.6}
                />
            </mesh>
            {/* Outer ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.9, 1.1, 64]} />
                <meshStandardMaterial
                    color="#002233"
                    emissive="#00aaff"
                    emissiveIntensity={1.2}
                    transparent
                    opacity={0.8}
                />
            </mesh>
        </group>
    );
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function Avatar3D({ avatarState = 'idle', isTaskFound = false, theme = 'cyberpunk' }) {
    const [behaviorLabel, setBehaviorLabel] = useState('💭 Idle...');
    const stateColors = { idle: '#63b3ed', listening: '#68d391', thinking: '#9f7aea', talking: '#f6ad55' };

    // Theme Colors Definition
    const themeColors = {
        cyberpunk: {
            ambient: "#d0c8ff",
            ambientInt: 1.8,
            dirColor: "#ffffff",
            point1: "#9f7aea",
            point2: "#63b3ed",
            point3: "#00e5ff",
            fog: "#07041a"
        },
        morning: {
            ambient: "#fff0e5",
            ambientInt: 1.5,
            dirColor: "#ffecd2",
            point1: "#ffb7b2",
            point2: "#ffdac1",
            point3: "#e2f0cb",
            fog: "#ffe4e1"
        },
        void: {
            ambient: "#1a1a2e",
            ambientInt: 0.8,
            dirColor: "#16213e",
            point1: "#e94560",
            point2: "#0f3460",
            point3: "#533483",
            fog: "#050505"
        }
    };

    const currentTheme = themeColors[theme] || themeColors.cyberpunk;

    return (
        <>
            <Canvas
                className="avatar-canvas"
                camera={{ position: [0, 0.6, 3.5], fov: 42 }}
                gl={{ antialias: true, alpha: true }}
                shadows
                style={{ background: 'transparent' }}
                onCreated={({ gl, scene }) => {
                    gl.shadowMap.enabled = true;
                    gl.shadowMap.type = THREE.PCFSoftShadowMap;
                    // Light fog — only affects far background, not the character
                    scene.fog = new THREE.FogExp2(currentTheme.fog, 0.07);
                }}
            >
                {/* Lighting matched to the current theme */}
                <ambientLight intensity={currentTheme.ambientInt} color={currentTheme.ambient} />
                {/* Key light */}
                <directionalLight position={[-3, 5, 3]} intensity={2.8} castShadow
                    shadow-mapSize-width={1024} shadow-mapSize-height={1024}
                    color={currentTheme.dirColor} />
                {/* Colored Rim Lights */}
                <pointLight position={[-3, 2, 1]} intensity={2.2} color={currentTheme.point1} distance={8} />
                <pointLight position={[3, 1, 1]} intensity={1.8} color={currentTheme.point2} distance={8} />
                <pointLight position={[0, -1.2, 1.5]} intensity={1.2} color={currentTheme.point3} distance={5} />
                {/* Warm fill — lights the face from the front */}
                <pointLight position={[0, 2, 4]} intensity={2.0} color="#ffffff" distance={7} />

                <Suspense fallback={<LoadingSpinner />}>
                    <AvatarErrorBoundary>
                        <AvatarModel
                            avatarState={avatarState}
                            isTaskFound={isTaskFound}
                            onBehaviorLabel={setBehaviorLabel}
                        />
                    </AvatarErrorBoundary>
                    <GlowPlatform />
                    {/* Wide diffuse shadow to sell contact with the lit platform */}
                    <ContactShadows position={[0, -1.55, 0]} opacity={0.85} scale={3.5} blur={1.5} far={3} color="#000820" />
                </Suspense>

                <OrbitControls
                    enableZoom={false}
                    enablePan={false}
                    minPolarAngle={Math.PI * 0.25}
                    maxPolarAngle={Math.PI * 0.65}
                    minAzimuthAngle={-Math.PI * 0.35}
                    maxAzimuthAngle={Math.PI * 0.35}
                    target={[0, -0.1, 0]}
                    autoRotate={avatarState === 'idle'}
                    autoRotateSpeed={0.4}
                />
            </Canvas>

            <div className="avatar-state-label" style={{ color: stateColors[avatarState] }}>
                {behaviorLabel}
            </div>
        </>
    );
}
