// ─────────────────────────────────────────────────────────────────────────────
// Nova Avatar Playlist Configuration
// ─────────────────────────────────────────────────────────────────────────────
//
// HOW TO ADD A NEW AVATAR:
//  1. Export your character + animation from Mixamo as a GLB file
//     (check "In Place" if available, 30fps, without skin is fine)
//  2. Drop the .glb file into:  client/public/models/
//  3. Add a new entry below — that's it!
//
// Each entry can be:
//   - A plain path string:  '/models/avatar4.glb'
//   - Or an object with optional metadata:
//       { url: '/models/avatar4.glb', label: 'Dancing' }
//
// The animations play in order, looping back to the first when the last
// one finishes.  Each clip plays ONCE before advancing to the next.
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_PLAYLIST = [
    { url: '/models/avatar.glb', label: 'Avatar 1' },
    { url: '/models/avatar2.glb', label: 'Avatar 2' },
    { url: '/models/avatar3.glb', label: 'Avatar 3', speed: 0.1 },
    { url: '/models/avatar4.glb', label: 'Avatar 4' },
    // { url: '/models/avatar5.glb', label: 'Avatar 5' },← uncomment to add
];

export default AVATAR_PLAYLIST;
