import { createContext, useContext } from 'react';

// The page's join state (JoinProvider): { viewer, stateOf(classId), open(classItem), show(classItem) }.
export const JoinContext = createContext(null);

// Null outside a JoinProvider (e.g. the staff's preview of a class card): the card then offers no way in.
export const useJoin = () => useContext(JoinContext);
