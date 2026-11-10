import { createContext, useContext } from 'react';

const EMPTY = { data: undefined, loading: false, refresh: () => {} };

export const MyDuesContext = createContext(EMPTY);

// { data: loadMyDues() result | undefined, loading, refresh(fresh?) }. Safe outside the provider.
export const useMyDues = () => useContext(MyDuesContext);
