/**
 * Team Jitsi meetings: create rooms, list, end, Whisper, recap.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { api, ApiError } from "@/lib/api";
import { isRealAuthPathReady } from "@/lib/auth/config";
import type { MeetingRecap, TeamMeeting } from "@/types";

function formatError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error) return err.message;
  return fallback;
}

export function useTeamMeetings() {
  const { isBypassMode } = useAuth();
  const { team } = useWorkspace();
  const [meetings, setMeetings] = useState<TeamMeeting[]>([]);
  const [activeMeeting, setActiveMeeting] = useState<TeamMeeting | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamId = team?.id ?? null;
  const live = isRealAuthPathReady() || !isBypassMode;

  const refresh = useCallback(async () => {
    if (!teamId || !live) {
      setMeetings([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await api.meetings.list(teamId);
      setMeetings(next);
    } catch (err) {
      setMeetings([]);
      setError(formatError(err, "Could not load meetings"));
    } finally {
      setLoading(false);
    }
  }, [teamId, live]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createMeeting = useCallback(
    async (title: string) => {
      if (!teamId) throw new Error("No active team");
      setCreating(true);
      setError(null);
      try {
        const created = await api.meetings.create(teamId, { title });
        setMeetings((prev) => [created, ...prev]);
        setActiveMeeting(created);
        return created;
      } catch (err) {
        const message = formatError(err, "Could not create meeting");
        setError(message);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setCreating(false);
      }
    },
    [teamId]
  );

  const endMeeting = useCallback(
    async (meetingId: string) => {
      if (!teamId) throw new Error("No active team");
      const ended = await api.meetings.end(teamId, meetingId);
      setMeetings((prev) => prev.map((m) => (m.id === ended.id ? ended : m)));
      setActiveMeeting((prev) => (prev?.id === ended.id ? ended : prev));
      return ended;
    },
    [teamId]
  );

  const transcribe = useCallback(
    async (meetingId: string, file: File) => {
      if (!teamId) throw new Error("No active team");
      setTranscribing(true);
      setError(null);
      try {
        return await api.meetings.transcribe(teamId, meetingId, file);
      } catch (err) {
        const message = formatError(err, "Could not transcribe audio");
        setError(message);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setTranscribing(false);
      }
    },
    [teamId]
  );

  const recapFromMeeting = useCallback(
    async (meetingId: string, transcript: string): Promise<MeetingRecap> => {
      if (!teamId) throw new Error("No active team");
      return api.meetings.recap(teamId, meetingId, transcript);
    },
    [teamId]
  );

  return {
    meetings,
    activeMeeting,
    setActiveMeeting,
    loading,
    creating,
    transcribing,
    error,
    hasTeam: Boolean(teamId),
    isLive: live,
    refresh,
    createMeeting,
    endMeeting,
    transcribe,
    recapFromMeeting,
    clearError: () => setError(null),
  };
}
