import { useState, useEffect } from "react";

interface GroupSession {
  groupId: string;
  memberId: string;
  memberName: string;
  groupName: string;
  groupCode: string;
}

export function useGroupSession() {
  const [session, setSession] = useState<GroupSession | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("expense_group_session");
    if (stored) {
      try {
        setSession(JSON.parse(stored));
      } catch {
        localStorage.removeItem("expense_group_session");
      }
    }
  }, []);

  const saveSession = (data: GroupSession) => {
    localStorage.setItem("expense_group_session", JSON.stringify(data));
    setSession(data);
  };

  const clearSession = () => {
    localStorage.removeItem("expense_group_session");
    setSession(null);
  };

  return { session, saveSession, clearSession };
}
