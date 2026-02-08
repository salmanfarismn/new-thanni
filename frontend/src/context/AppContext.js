import { useState, useEffect, createContext, useContext } from 'react';
import api from '../api/axios';  // Use the configured axios instance

// Re-export api for backward compatibility
export { default as api } from '../api/axios';

// Company Name Context
const CompanyNameContext = createContext();

export function useCompanyName() {
    return useContext(CompanyNameContext);
}

export function CompanyNameProvider({ children }) {
    // Initialize from localStorage to avoid "Thanni Canuuu" flash
    const [companyName, setCompanyName] = useState(() => {
        return localStorage.getItem('company_name') || 'Thanni Canuuu';
    });
    const [logoUrl, setLogoUrl] = useState(() => {
        return localStorage.getItem('logo_url') || null;
    });
    // Add vendor state for reactive updates
    const [vendor, setVendor] = useState(() => {
        const stored = localStorage.getItem('vendor');
        try {
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });
    const [loading, setLoading] = useState(true);

    const loadSettings = async () => {
        try {
            // 1. Fetch Company Name
            const response = await api.get('/app-settings');
            const newName = response.data.company_name || 'Thanni Canuuu';
            setCompanyName(newName);
            localStorage.setItem('company_name', newName);

            // 2. Fetch Logo
            const logoRes = await api.get('/app-settings/logo');
            let url = logoRes.data.logo_url;

            if (url && url.startsWith('/static')) {
                const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
                url = `${backendUrl}${url}`;
            }

            setLogoUrl(url);
            if (url) {
                localStorage.setItem('logo_url', url);
            } else {
                localStorage.removeItem('logo_url');
            }

            // 3. Fetch/Sync Vendor Info
            const vendorRes = await api.get('/auth/me');
            if (vendorRes.data) {
                setVendor(vendorRes.data);
                localStorage.setItem('vendor', JSON.stringify(vendorRes.data));
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateCompanyName = (name) => {
        setCompanyName(name);
        localStorage.setItem('company_name', name);
    };

    const updateLogoUrl = (url) => {
        setLogoUrl(url);
        if (url) {
            localStorage.setItem('logo_url', url);
        } else {
            localStorage.removeItem('logo_url');
        }
    };

    const updateVendor = (vendorData) => {
        setVendor(vendorData);
        localStorage.setItem('vendor', JSON.stringify(vendorData));
    };

    useEffect(() => {
        loadSettings();
    }, []);

    return (
        <CompanyNameContext.Provider value={{
            companyName,
            setCompanyName: updateCompanyName,
            logoUrl,
            setLogoUrl: updateLogoUrl,
            vendor,
            setVendor: updateVendor,
            refreshCompanyName: loadSettings,
            loading
        }}>
            {children}
        </CompanyNameContext.Provider>
    );
}
