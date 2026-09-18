import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { AppBackground } from "@/components/layout/AppBackground";
import { LinearExpandMenu } from "@/components/layout/LinearExpandMenu";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { CodeActivityPanel } from "@/components/dashboard/CodeActivityPanel";
import { GitHubActivity } from "@/components/dashboard/GitHubActivity";
import { RecentRecaps } from "@/components/dashboard/RecentRecaps";
import { RecapReviewModal } from "@/components/dashboard/RecapReviewModal";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { TeamChat } from "@/components/dashboard/TeamChat";
import { UpcomingMeetings } from "@/components/dashboard/UpcomingMeetings";
import {
  MeetingRoom,
  StartMeetingForm,
} from "@/components/meetings/MeetingRoom";
import { TasksBoard } from "@/components/tasks/TasksBoard";
import { TeamWorkspacePanel } from "@/components/workspace/TeamWorkspacePanel";
import { useTeamChat } from "@/hooks/useTeamChat";
import { useTeamMeetings } from "@/hooks/useTeamMeetings";
import { useTeamRecaps } from "@/hooks/useTeamRecaps";
import { useTeamTasks } from "@/hooks/useTeamTasks";
import type { MeetingRecap, TaskStatus } from "@/types";

export function DashboardPage() {
  const { user, logout } = useAuth();
  const { org, team } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [recapMode, setRecapMode] = useState<"create" | "review" | null>(null);
  const [activeRecap, setActiveRecap] = useState<MeetingRecap | null>(null);
  const [startMeetingOpen, setStartMeetingOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const {
    tasks,
    people,
    loading: tasksLoading,
    error: tasksError,
    openCount,
    isDemo,
    hasTeam,
    createTask,
    updateTask,
    moveTask,
    removeTask,
    clearError,
  } = useTeamTasks();
  const chat = useTeamChat();
  const recaps = useTeamRecaps();
  const meetings = useTeamMeetings();

  const meetingQuery = searchParams.get("meeting");

  useEffect(() => {
    if (!meetingQuery || !team?.id) return;
    void meetings.openMeetingById(meetingQuery).then((opened) => {
      if (opened) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("meeting");
            return next;
          },
          { replace: true }
        );
      }
    });
    // Intentionally only when the query / team changes — not on every meetings identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once per ?meeting=
  }, [meetingQuery, team?.id]);

  if (!user) {
    return null;
  }

  const showTeam = activeNav === "Team";
  const showTasks = activeNav === "Tasks";
  const showChat = activeNav === "Chat";
  const showCode = activeNav === "Code";

  return (
    <div className="clarity-dashboard relative z-10 text-foreground">
      <AppBackground />

      <LinearExpandMenu
        open={navOpen}
        onOpenChange={setNavOpen}
        activeItem={activeNav}
        onNavigate={setActiveNav}
        onLogout={logout}
        counts={{ Tasks: String(openCount) }}
      />

      <main className="relative z-10">
        <div className="mx-auto max-w-[1380px] px-5 pb-9 pt-20 sm:px-8 lg:px-10">
          <DashboardHeader
            user={user}
            orgName={org?.name}
            teamName={team?.name}
            onNewMeeting={() => setStartMeetingOpen(true)}
          />

          {showTeam ? (
            <TeamWorkspacePanel />
          ) : showTasks ? (
            <TasksBoard
              tasks={tasks}
              people={people}
              loading={tasksLoading}
              error={tasksError}
              isDemo={isDemo}
              hasTeam={hasTeam}
              currentUser={user}
              onCreate={async (input) => {
                await createTask({
                  title: input.title,
                  description: input.description || null,
                  status: input.status,
                  assignee_id: input.assignee_id ?? null,
                  due_date: input.due_date ?? null,
                  story_points: input.story_points ?? null,
                  parent_task_id: input.parent_task_id ?? null,
                });
              }}
              onUpdate={async (taskId, input) => {
                await updateTask(taskId, {
                  title: input.title,
                  description: input.description || null,
                  assignee_id: input.assignee_id,
                  due_date: input.due_date,
                  story_points: input.story_points,
                  parent_task_id: input.parent_task_id,
                });
              }}
              onMove={async (taskId, status: TaskStatus) => {
                await moveTask(taskId, { status });
              }}
              onDelete={async (taskId) => {
                await removeTask(taskId);
              }}
              onClearError={clearError}
            />
          ) : showChat ? (
            <ChatPanel
              channels={chat.channels}
              members={chat.members}
              activeChannel={chat.activeChannel}
              messages={chat.messages}
              hasMore={chat.hasMore}
              loadingChannels={chat.loadingChannels}
              loadingMessages={chat.loadingMessages}
              sending={chat.sending}
              error={chat.error}
              isDemo={chat.isDemo}
              hasTeam={chat.hasTeam}
              currentUser={user}
              onSelectChannel={chat.selectChannel}
              onCreateChannel={async (name, description) => {
                await chat.createChannel({
                  name,
                  description: description ?? null,
                });
              }}
              onStartDm={async (userId) => {
                await chat.startDm({ user_id: userId });
              }}
              onCreateGroup={async (name, memberIds) => {
                await chat.createGroup({ name, member_ids: memberIds });
              }}
              onSend={async (body) => {
                await chat.sendMessage({ body });
              }}
              onLoadOlder={chat.loadOlder}
              onClearError={chat.clearError}
            />
          ) : showCode ? (
            <CodeActivityPanel />
          ) : (
            <>
              <StatsCards
                openTasksCount={openCount}
                tasksLoading={tasksLoading}
                meetingsTodayCount={
                  meetings.meetings.filter((meeting) => {
                    const start = new Date(meeting.started_at ?? meeting.created_at);
                    if (Number.isNaN(start.getTime())) return false;
                    const now = new Date();
                    return (
                      start.getFullYear() === now.getFullYear() &&
                      start.getMonth() === now.getMonth() &&
                      start.getDate() === now.getDate()
                    );
                  }).length
                }
              />

              <div className="grid items-start gap-6 xl:grid-cols-[1.16fr_0.84fr]">
                <div className="flex flex-col gap-6">
                  <RecentRecaps
                    recaps={recaps.recaps}
                    loading={recaps.loading}
                    error={recaps.error}
                    hasTeam={recaps.hasTeam}
                    onClearError={recaps.clearError}
                    onCreate={() => {
                      setActiveRecap(null);
                      setRecapMode("create");
                    }}
                    onOpenRecap={(recap) => {
                      setActiveRecap(recap);
                      setRecapMode("review");
                    }}
                  />
                  <GitHubActivity showConnect />
                </div>

                <div className="flex flex-col gap-6">
                  <UpcomingMeetings
                    meetings={meetings.meetings}
                    loading={meetings.loading}
                    hasTeam={meetings.hasTeam}
                    onCreate={() => setStartMeetingOpen(true)}
                    onJoin={(meeting) => meetings.setActiveMeeting(meeting)}
                  />
                  <TeamChat
                    hasTeam={chat.hasTeam}
                    loading={chat.loadingMessages || chat.loadingChannels}
                    channelName={chat.activeChannel?.name}
                    messages={chat.messages}
                    onOpenChat={() => setActiveNav("Chat")}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {startMeetingOpen && !meetings.activeMeeting && (
        <StartMeetingForm
          creating={meetings.creating}
          error={meetings.error}
          onCancel={() => setStartMeetingOpen(false)}
          onStart={async (title) => {
            await meetings.createMeeting(title);
            setStartMeetingOpen(false);
          }}
        />
      )}

      {meetings.activeMeeting && (
        <MeetingRoom
          meeting={meetings.activeMeeting}
          transcribing={meetings.transcribing}
          error={meetings.error}
          onClose={() => meetings.setActiveMeeting(null)}
          onEnd={async () => {
            await meetings.endMeeting(meetings.activeMeeting!.id);
          }}
          onTranscribe={(file) =>
            meetings.transcribe(meetings.activeMeeting!.id, file)
          }
          onCreateRecap={(transcript) =>
            meetings.recapFromMeeting(meetings.activeMeeting!.id, transcript)
          }
          onRecapReady={(recap) => {
            void recaps.refresh();
            setActiveRecap(recap);
            setRecapMode("review");
            meetings.setActiveMeeting(null);
          }}
        />
      )}

      {recapMode && (
        <RecapReviewModal
          mode={recapMode}
          recap={activeRecap}
          generating={recaps.generating}
          error={recaps.error}
          onClose={() => {
            setRecapMode(null);
            setActiveRecap(null);
          }}
          onGenerate={async (input) => {
            const created = await recaps.generate(input);
            setActiveRecap(created);
            setRecapMode("review");
            return created;
          }}
          onSave={async (input) => {
            if (!activeRecap) throw new Error("No recap selected");
            const next = await recaps.update(activeRecap.id, input);
            setActiveRecap(next);
            return next;
          }}
          onSend={async () => {
            if (!activeRecap) throw new Error("No recap selected");
            const next = await recaps.send(activeRecap.id);
            setActiveRecap(next);
            return next;
          }}
        />
      )}
    </div>
  );
}
