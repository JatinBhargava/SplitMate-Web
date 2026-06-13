import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, LogIn, ChevronRight, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { Footer } from "@/components/Footer";

interface GroupSession {
  groupId: string;
  memberId: string;
  memberName: string;
  groupName: string;
  groupCode: string;
}

interface JoinGroupProps {
  onJoined: (data: GroupSession) => void;
  userName: string;
  onSignOut: () => void;
  userId: string;
}

interface MyGroup {
  groupId: string;
  memberId: string;
  groupName: string;
  groupCode: string;
  memberCount: number;
}

export function JoinGroup({ onJoined, userName, onSignOut, userId }: JoinGroupProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [myGroups, setMyGroups] = useState<MyGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [createGroupName, setCreateGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const fetchMyGroups = async () => {
    setLoadingGroups(true);
    const { data: memberships } = await supabase
      .from("group_members")
      .select("id, name, group_id")
      .eq("user_id", userId);

    if (!memberships || memberships.length === 0) {
      setMyGroups([]);
      setLoadingGroups(false);
      return;
    }

    const groupIds = memberships.map((m) => m.group_id);
    const { data: groups } = await supabase
      .from("expense_groups")
      .select("id, name, code")
      .in("id", groupIds);

    if (!groups) {
      setMyGroups([]);
      setLoadingGroups(false);
      return;
    }

    const { data: allMembers } = await supabase
      .from("group_members")
      .select("group_id")
      .in("group_id", groupIds);

    const countMap: Record<string, number> = {};
    allMembers?.forEach((m) => {
      countMap[m.group_id] = (countMap[m.group_id] || 0) + 1;
    });

    const result: MyGroup[] = groups.map((g) => {
      const membership = memberships.find((m) => m.group_id === g.id);
      return {
        groupId: g.id,
        memberId: membership!.id,
        groupName: g.name,
        groupCode: g.code,
        memberCount: countMap[g.id] || 0,
      };
    });

    setMyGroups(result);
    setLoadingGroups(false);
  };

  useEffect(() => {
    fetchMyGroups();
  }, [userId]);

  const generateCode = () => String(Math.floor(1000 + Math.random() * 9000));

  const handleCreate = async () => {
    if (!createGroupName.trim()) {
      toast({ title: "Please enter a group name", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const code = generateCode();
      const { data: group, error: groupError } = await supabase
        .from("expense_groups")
        .insert({ name: createGroupName.trim(), code, created_by: userId })
        .select()
        .single();
      if (groupError) throw groupError;

      const { data: member, error: memberError } = await supabase
        .from("group_members")
        .insert({ group_id: group.id, name: userName, user_id: userId })
        .select()
        .single();
      if (memberError) throw memberError;

      await supabase.from("activity_log").insert({
        group_id: group.id, member_id: member.id,
        action: "GROUP_CREATED",
        details: `${userName} created group "${createGroupName.trim()}"`,
      });

      onJoined({
        groupId: group.id, memberId: member.id,
        memberName: member.name, groupName: group.name, groupCode: group.code,
      });
      toast({ title: `Group created! Code: ${code}`, description: "Share this code with your friends." });
    } catch (err: any) {
      toast({ title: "Error creating group", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim() || joinCode.trim().length !== 4) {
      toast({ title: "Code must be 4 digits", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: group, error: groupError } = await supabase
        .from("expense_groups").select().eq("code", joinCode.trim()).single();
      if (groupError || !group) {
        toast({ title: "Group not found", variant: "destructive" });
        setLoading(false);
        return;
      }

      const { data: existingMember } = await supabase
        .from("group_members").select().eq("group_id", group.id).eq("user_id", userId).single();

      let member;
      if (existingMember) {
        member = existingMember;
      } else {
        const { data: newMember, error: memberError } = await supabase
          .from("group_members")
          .insert({ group_id: group.id, name: userName, user_id: userId })
          .select().single();
        if (memberError) throw memberError;
        member = newMember;

        await supabase.from("activity_log").insert({
          group_id: group.id, member_id: member.id,
          action: "MEMBER_JOINED", details: `${userName} joined the group`,
        });
      }

      onJoined({
        groupId: group.id, memberId: member.id,
        memberName: member.name, groupName: group.name, groupCode: group.code,
      });
    } catch (err: any) {
      toast({ title: "Error joining group", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openGroup = (g: MyGroup) => {
    onJoined({
      groupId: g.groupId, memberId: g.memberId,
      memberName: userName, groupName: g.groupName, groupCode: g.groupCode,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Navbar */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-lg font-bold font-display tracking-tight">SplitMate</h1>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <ProfileDropdown memberName={userName} userId={userId} onSignOut={onSignOut} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-lg animate-slide-up">
          <div className="text-center mb-6">
            <p className="text-muted-foreground">Welcome, <span className="font-semibold text-foreground">{userName}</span></p>
          </div>

          <Card className="glass-card">
            <Tabs defaultValue="my-groups">
              <TabsList className="w-full grid grid-cols-3 h-12">
                <TabsTrigger value="my-groups" className="gap-1.5 text-sm font-medium">
                  <Users className="w-4 h-4" /> My Groups
                </TabsTrigger>
                <TabsTrigger value="join" className="gap-1.5 text-sm font-medium">
                  <LogIn className="w-4 h-4" /> Join
                </TabsTrigger>
                <TabsTrigger value="create" className="gap-1.5 text-sm font-medium">
                  <Plus className="w-4 h-4" /> Create
                </TabsTrigger>
              </TabsList>

              <TabsContent value="my-groups">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-lg">My Groups</CardTitle>
                  <CardDescription>Tap a group to open it</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingGroups ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : myGroups.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p>No groups yet.</p>
                      <p>Create or join one to get started!</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {myGroups.map((g) => (
                        <button
                          key={g.groupId}
                          onClick={() => openGroup(g)}
                          className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-left"
                        >
                          <div>
                            <p className="font-medium text-foreground">{g.groupName}</p>
                            <p className="text-sm text-muted-foreground">Code: {g.groupCode} · {g.memberCount} members</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </TabsContent>

              <TabsContent value="join">
                <CardHeader>
                  <CardTitle className="font-display text-lg">Join an Existing Group</CardTitle>
                  <CardDescription>Enter the 4-digit code shared by your friend</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4" onKeyDown={(e) => e.key === "Enter" && !loading && handleJoin()}>
                  <Input
                    placeholder="4-digit group code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    maxLength={4}
                    className="text-center text-2xl font-display tracking-[0.5em]"
                  />
                  <Button onClick={handleJoin} disabled={loading} className="w-full">
                    {loading ? "Joining..." : "Join Group"}
                  </Button>
                </CardContent>
              </TabsContent>

              <TabsContent value="create">
                <CardHeader>
                  <CardTitle className="font-display text-lg">Create a New Group</CardTitle>
                  <CardDescription>Start a group and invite friends with a 4-digit code</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4" onKeyDown={(e) => e.key === "Enter" && !loading && handleCreate()}>
                  <Input
                    placeholder="Group name (e.g. Weekend Trip)"
                    value={createGroupName}
                    onChange={(e) => setCreateGroupName(e.target.value)}
                    maxLength={100}
                  />
                  <Button onClick={handleCreate} disabled={loading} className="w-full">
                    {loading ? "Creating..." : "Create Group"}
                  </Button>
                </CardContent>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
