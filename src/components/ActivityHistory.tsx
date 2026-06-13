import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Clock, Plus, Pencil, Trash2, UserPlus, FolderPlus } from "lucide-react";

interface Member {
  id: string;
  name: string;
}

interface ActivityLog {
  id: string;
  action: string;
  details: string | null;
  member_id: string;
  created_at: string;
}

interface ActivityHistoryProps {
  groupId: string;
  members: Member[];
}

const actionIcons: Record<string, typeof Plus> = {
  EXPENSE_CREATED: Plus,
  EXPENSE_UPDATED: Pencil,
  EXPENSE_DELETED: Trash2,
  MEMBER_JOINED: UserPlus,
  GROUP_CREATED: FolderPlus,
};

export function ActivityHistory({ groupId, members }: ActivityHistoryProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setLogs(data);
      setLoading(false);
    };
    fetchLogs();
  }, [groupId]);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const Icon = actionIcons[log.action] || Clock;
        return (
          <Card key={log.id} className="p-3 flex items-start gap-3">
            <div className="mt-0.5 p-1.5 rounded-lg bg-muted">
              <Icon className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">{log.details}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(log.created_at).toLocaleString()}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
