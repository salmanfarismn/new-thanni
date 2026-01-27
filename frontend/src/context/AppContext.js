import { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';

// API Configuration
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const api = axios.create({
    baseURL: API,
});

// Company Name Context
const CompanyNameContext = createContext();

export function useCompanyName() {
    return useContext(CompanyNameContext);
}

export function CompanyNameProvider({ children }) {
    const [companyName, setCompanyName] = useState('Thanni Canuuu');
    const [loading, setLoading] = useState(true);

    const loadCompanyName = async () => {
        try {
            const response = await api.get('/app-settings');
            setCompanyName(response.data.company_name || 'Thanni Canuuu');
        } catch (error) {
            console.error('Error loading company name:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCompanyName();
    }, []);

    return (
        <CompanyNameContext.Provider value={{ companyName, setCompanyName, refreshCompanyName: loadCompanyName, loading }}>
            {children}
        </CompanyNameContext.Provider>
    );
}
