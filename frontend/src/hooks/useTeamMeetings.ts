/**
 * Team Jitsi meetings: create rooms, list, end, Whisper, recap.
 *
 * Active meeting is stored in sessionStorage so leaving for WhatsApp / refresh
 * does not wipe the host's open room (they can rejoin from Meetings or auto-restore).
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

function activeMeetingKey(teamId: string): string {
  return `clarity:active-meeting:${teamId}`;
}

function readStoredMeetingId(teamId: string): string | null {
  try {
    return sessionStorage.getItem(activeMeetingKey(teamId));
  } catch {
    return null;
  }
}

function writeStoredMeetingId(teamId: string, meetingId: string | null): void {
  try {
    const key = activeMeetingKey(teamId);
    if (meetingId) sessionStorage.setItem(key, meetingId);
    else sessionStorage.removeItem(key);
  } catch {
    /* private mode / blocked storage */
  }
}

export function useTeamMeetings() {
  const { isBypassMode } = useAuth();
  const { team } = useWorkspace();
  const [meetings, setMeetings] = useState<TeamMeeting[]>([]);
  const [activeMeeting, setActiveMeetingState] = useState<TeamMeeting | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamId = team?.id ?? null;
  const live = isRealAuthPathReady() || !isBypassMode;

  const setActiveMeeting = useCallback(
    (meeting: TeamMeeting | null) => {
      setActiveMeetingState(meeting);
      if (teamId) {
        writeStoredMeetingId(teamId, meeting && meeting.status !== "ended" ? meeting.id : null);
      }
    },
    [teamId]
  );

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

      const savedId = readStoredMeetingId(teamId);
      if (savedId) {
        const saved =
          next.find((m) => m.id === savedId && m.status !== "ended") ?? null;
        if (saved) {
          setActiveMeetingState(saved);
        } else {
          writeStoredMeetingId(teamId, null);
          setActiveMeetingState((prev) => (prev?.id === savedId ? null : prev));
        }
      }
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
    [teamId, setActiveMeeting]
  );

  const endMeeting = useCallback(
    async (meetingId: string) => {
      if (!teamId) throw new Error("No active team");
      const ended = await api.meetings.end(teamId, meetingId);
      setMeetings((prev) => prev.map((m) => (m.id === ended.id ? ended : m)));
      setActiveMeetingState((prev) => (prev?.id === ended.id ? ended : prev));
      writeStoredMeetingId(teamId, null);
      return ended;
    },
    [teamId]
  );

  const openMeetingById = useCallback(
    async (meetingId: string) => {
      if (!teamId) return null;
      const fromList = meetings.find((m) => m.id === meetingId);
      if (fromList) {
        setActiveMeeting(fromList);
        return fromList;
      }
      try {
        const meeting = await api.meetings.get(teamId, meetingId);
        setMeetings((prev) =>
          prev.some((m) => m.id === meeting.id) ? prev : [meeting, ...prev]
        );
        setActiveMeeting(meeting);
        return meeting;
      } catch (err) {
        setError(formatError(err, "Could not open meeting"));
        return null;
      }
    },
    [teamId, meetings, setActiveMeeting]
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
    openMeetingById,
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
