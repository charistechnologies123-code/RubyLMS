import {
  LayoutDashboard,
  BookOpen,
  Users,
  ClipboardList,
  Bell,
  User,
  MessageSquare,
  Shield,
  GraduationCap,
  CircleHelp,
} from "lucide-react";

export type Role = "STUDENT" | "INSTRUCTOR" | "ADMIN";

export const navigation = {
  STUDENT: [
    { name: "Dashboard", href: "/student", icon: LayoutDashboard },
    { name: "Courses", href: "/courses", icon: BookOpen },
    { name: "Assignments", href: "/assignments", icon: ClipboardList },
    { name: "Quizzes", href: "/quizzes", icon: CircleHelp },
    { name: "Grades", href: "/grades", icon: ClipboardList },
    { name: "Q&A", href: "/questions", icon: MessageSquare },
    { name: "Announcements", href: "/announcements", icon: Bell },
    { name: "Notifications", href: "/notifications", icon: Bell },
    { name: "Profile", href: "/profile", icon: User },
  ],

  INSTRUCTOR: [
    { name: "Dashboard", href: "/instructor", icon: LayoutDashboard },
    { name: "My Courses", href: "/courses", icon: BookOpen },
    { name: "Students", href: "/students", icon: Users },
    { name: "Assignments", href: "/assignments", icon: ClipboardList },
    { name: "Gradebook", href: "/gradebook", icon: ClipboardList },
    { name: "Quizzes", href: "/quizzes", icon: CircleHelp },
    { name: "Announcements", href: "/announcements", icon: Bell },
    { name: "Q&A", href: "/questions", icon: MessageSquare },
    { name: "Notifications", href: "/notifications", icon: Bell },
    { name: "Profile", href: "/profile", icon: User },
  ],

  ADMIN: [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Users", href: "/users", icon: Users },
    { name: "Courses", href: "/courses", icon: BookOpen },
    { name: "Enrollments", href: "/students", icon: GraduationCap },
    { name: "Assignments", href: "/assignments", icon: ClipboardList },
    { name: "Gradebook", href: "/gradebook", icon: ClipboardList },
    { name: "Quizzes", href: "/quizzes", icon: CircleHelp },
    { name: "Archives", href: "/archives", icon: Shield },
    { name: "Announcements", href: "/announcements", icon: Bell },
    { name: "Q&A", href: "/questions", icon: MessageSquare },
    { name: "Notifications", href: "/notifications", icon: Bell },
    { name: "Audit Logs", href: "/audit-logs", icon: Shield },
    { name: "Profile", href: "/profile", icon: User },
  ],
};
