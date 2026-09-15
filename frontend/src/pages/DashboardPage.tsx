import { useState } from "react";
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
import { TasksBoard } from "@/components/tasks/TasksBoard";
import { TeamWorkspacePanel } from "@/components/workspace/TeamWorkspacePanel";
import { useTeamChat } from "@/hooks/useTeamChat";
import { useTeamTasks } from "@/hooks/useTeamTasks";
import type { TaskStatus } from "@/types";

export function DashboardPage() {
  const { user, logout } = useAuth();
  const { org, team } = useWorkspace();
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [modalOpen, setModalOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const {
    tasks,
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
            onNewMeeting={() => setModalOpen(true)}
          />

          {showTeam ? (
            <TeamWorkspacePanel />
          ) : showTasks ? (
            <TasksBoard
              tasks={tasks}
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
                });
              }}
              onUpdate={async (taskId, input) => {
                await updateTask(taskId, {
                  title: input.title,
                  description: input.description || null,
                  assignee_id: input.assignee_id,
                  due_date: input.due_date,
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
              <StatsCards openTasksCount={openCount} tasksLoading={tasksLoading} />

              <div className="grid items-start gap-6 xl:grid-cols-[1.16fr_0.84fr]">
                <div className="flex flex-col gap-6">
                  <RecentRecaps onOpenRecap={() => setModalOpen(true)} />
                  <GitHubActivity showConnect />
                </div>

                <div className="flex flex-col gap-6">
                  <UpcomingMeetings />
                  <TeamChat onOpenChat={() => setActiveNav("Chat")} />
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {modalOpen && <RecapReviewModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
