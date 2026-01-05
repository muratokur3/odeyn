import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useAuthLogic } from '../hooks/useAuthLogic';
import type { User } from '../types';
import type { BlockRecord } from '../services/blockService';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    blockedUsers: BlockRecord[];
}

export const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    blockedUsers: []
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const auth = useAuthLogic();
    return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};
