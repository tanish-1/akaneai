import axios from 'axios';

const BASE_URL = '/api';

export const api = {
    sendMessage: async (userId, message, tone) => {
        const res = await axios.post(`${BASE_URL}/chat`, { userId, message, tone });
        return res.data;
    },

    getChatHistory: async (userId) => {
        const res = await axios.get(`${BASE_URL}/chat/history/${userId}`);
        return res.data;
    },

    getMemories: async (userId) => {
        const res = await axios.get(`${BASE_URL}/memory/${userId}`);
        return res.data;
    },

    addMemory: async (data) => {
        const res = await axios.post(`${BASE_URL}/memory`, data);
        return res.data;
    },

    deleteMemory: async (id) => {
        const res = await axios.delete(`${BASE_URL}/memory/${id}`);
        return res.data;
    },

    updateMemoryStatus: async (id, status) => {
        const res = await axios.patch(`${BASE_URL}/memory/${id}/status`, { status });
        return res.data;
    },

    updateMemory: async (id, data) => {
        const res = await axios.patch(`${BASE_URL}/memory/${id}`, data);
        return res.data;
    },

    getDailyReport: async (userId, date) => {
        const res = await axios.get(`${BASE_URL}/report/${userId}/${date}`);
        return res.data;
    },

    generateDailyReport: async (userId, date) => {
        const res = await axios.post(`${BASE_URL}/report/generate`, { userId, date });
        return res.data;
    },

    clearHistory: async (userId) => {
        const res = await axios.delete(`${BASE_URL}/chat/history/${userId}`);
        return res.data;
    },

    healthCheck: async () => {
        const res = await axios.get(`${BASE_URL}/health`);
        return res.data;
    },

    getAnalytics: async (userId, days = 7) => {
        const res = await axios.get(`${BASE_URL}/analytics/${userId}?days=${days}`);
        return res.data;
    },

    getWeeklyInsights: async (userId) => {
        const res = await axios.get(`${BASE_URL}/analytics/${userId}/insights`);
        return res.data;
    }
};
