export type DatabaseTemplateId = "tasks" | "contacts" | "roadmap";

export type DatabaseTemplate = {
  id: DatabaseTemplateId;
  label: string;
  title: string;
  /** Shown on the template card thumbnail. */
  preview: string;
};

export const DATABASE_TEMPLATES: DatabaseTemplate[] = [
  {
    id: "tasks",
    label: "Task tracker",
    title: "Tasks",
    preview: "Name · Status · Due\nFirst task\nSecond task\nThird task",
  },
  {
    id: "contacts",
    label: "Contacts",
    title: "Contacts",
    preview: "Name · Email · Company\nAlex Kim\nJordan Lee",
  },
  {
    id: "roadmap",
    label: "Roadmap",
    title: "Roadmap",
    preview: "Feature · Status · Quarter\nLaunch v1\nAPI beta",
  },
];

export function getDatabaseTemplate(id: string) {
  return DATABASE_TEMPLATES.find((t) => t.id === id) ?? DATABASE_TEMPLATES[0];
}
