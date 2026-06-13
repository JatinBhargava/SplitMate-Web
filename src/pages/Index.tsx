import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { JoinGroup } from "@/components/JoinGroup";
import { GroupDashboard } from "@/components/GroupDashboard";
import Auth from "@/pages/Auth";

interface GroupSession {
  groupId: string;
  memberId: string;
  memberName: string;
  groupName: string;
  groupCode: string;
}

const Index = () => {
  const { user, loading, displayName, signOut } = useAuth();
  const [activeGroup, setActiveGroup] = useState<GroupSession | null>(null);

  // Clear group session when user changes (logout/login with different account)
  useEffect(() => {
    setActiveGroup(null);
  }, [user?.id]);

  const handleJoined = (data: GroupSession) => {
    setActiveGroup(data);
  };

  const handleLeave = () => {
    setActiveGroup(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  if (!activeGroup) {
    return <JoinGroup onJoined={handleJoined} userName={displayName} onSignOut={signOut} userId={user.id} />;
  }

  return (
    <GroupDashboard
      groupId={activeGroup.groupId}
      memberId={activeGroup.memberId}
      memberName={activeGroup.memberName}
      groupName={activeGroup.groupName}
      groupCode={activeGroup.groupCode}
      onLeave={handleLeave}
      onSignOut={signOut}
      userId={user.id}
    />
  );
};

export default Index;
