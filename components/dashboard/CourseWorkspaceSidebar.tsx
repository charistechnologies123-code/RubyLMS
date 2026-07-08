"use client";

import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

type WorkspacePage = {
  id: string;
  title: string;
  order: number;
};

type WorkspaceLesson = {
  id: string;
  title: string;
  order: number;
  status: string;
  pages: WorkspacePage[];
};

type CourseWorkspaceSidebarProps = {
  course: {
    id: string;
    title: string;
    lessons: WorkspaceLesson[];
  };
  activeLessonId?: string;
  activePageId?: string;
};

export default function CourseWorkspaceSidebar({
  course,
  activeLessonId,
  activePageId,
}: CourseWorkspaceSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(
    () => new Set(activeLessonId ? [activeLessonId] : course.lessons.slice(0, 1).map((lesson) => lesson.id)),
  );

  useEffect(() => {
    if (!activeLessonId) {
      return;
    }

    setExpandedLessons((current) => {
      const next = new Set(current);
      next.add(activeLessonId);
      return next;
    });
  }, [activeLessonId]);

  function toggleLesson(lessonId: string) {
    setExpandedLessons((current) => {
      const next = new Set(current);

      if (next.has(lessonId)) {
        next.delete(lessonId);
      } else {
        next.add(lessonId);
      }

      return next;
    });
  }

  return (
    <aside
      className={`rounded-[28px] border border-white/75 bg-white/90 shadow-[0_18px_60px_rgba(74,15,144,0.08)] backdrop-blur xl:sticky xl:top-24 xl:max-h-[calc(100vh-6.5rem)] xl:overflow-y-auto ${
        collapsed ? "xl:w-20" : "xl:w-80"
      }`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-[#f0e8ff] p-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Course workspace</p>
          {!collapsed ? (
            <>
              <p className="mt-1 truncate font-heading text-xl text-slate-950">{course.title}</p>
              <p className="mt-1 text-sm text-slate-600">{course.lessons.length} module(s) available</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-600">{course.lessons.length}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((current) => !current)}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#e8ddff] bg-white text-[#6b00ff]"
          aria-label={collapsed ? "Expand course sidebar" : "Collapse course sidebar"}
        >
          {collapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {!collapsed ? (
        <div className="space-y-5 p-4">
          {course.lessons.map((lesson) => {
            const isLessonActive = lesson.id === activeLessonId;
            const isExpanded = expandedLessons.has(lesson.id) || isLessonActive;

            return (
              <section
                key={lesson.id}
                className={`rounded-[24px] border p-3 transition ${
                  isLessonActive ? "border-[#d9c5ff] bg-[#fbf8ff]" : "border-[#efe6ff] bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleLesson(lesson.id)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                  aria-expanded={isExpanded}
                >
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Module {lesson.order}</p>
                    <p className={`mt-1 truncate font-semibold ${isLessonActive ? "text-[#6b00ff]" : "text-slate-950"}`}>
                      {lesson.title}
                    </p>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-slate-500 transition ${isExpanded ? "rotate-180" : ""}`}
                  />
                </button>

                <div className={`mt-3 space-y-1 ${isExpanded ? "block" : "hidden"}`}>
                  <Link
                    href={`/courses/${course.id}/lessons/${lesson.id}`}
                    className={`block rounded-2xl px-3 py-2 text-sm transition ${
                      isLessonActive && !activePageId
                        ? "bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] text-white"
                        : "text-slate-700 hover:bg-[#faf7ff]"
                    }`}
                  >
                    Open module
                  </Link>
                  {lesson.pages.length ? (
                    lesson.pages.map((page) => {
                      const isPageActive = page.id === activePageId;

                      return (
                        <Link
                          key={page.id}
                          href={`/courses/${course.id}/lessons/${lesson.id}/pages/${page.id}`}
                          className={`block rounded-2xl px-3 py-2 text-sm transition ${
                            isPageActive
                              ? "bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] text-white"
                              : "text-slate-600 hover:bg-[#faf7ff]"
                          }`}
                        >
                          <span className="mr-2 text-xs uppercase tracking-[0.16em] opacity-70">
                            {page.order}
                          </span>
                          {page.title}
                        </Link>
                      );
                    })
                  ) : (
                    <p className="rounded-2xl bg-[#faf7ff] px-3 py-2 text-sm text-slate-500">
                      No pages yet
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3 p-3">
          {course.lessons.map((lesson) => (
            <Link
              key={lesson.id}
              href={`/courses/${course.id}/lessons/${lesson.id}`}
              className={`flex h-12 items-center justify-center rounded-2xl text-xs font-semibold uppercase tracking-[0.2em] ${
                lesson.id === activeLessonId
                  ? "bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] text-white"
                  : "bg-[#faf7ff] text-slate-600"
              }`}
              aria-label={lesson.title}
            >
              {lesson.order}
            </Link>
          ))}
        </div>
      )}
    </aside>
  );
}
