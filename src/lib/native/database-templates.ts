import type {
  DatabaseProperty,
  DatabaseRowData,
  DatabaseScene,
  SelectOption,
} from "@/lib/databases/database-schema";

export type DatabaseTemplateId = "tasks" | "contacts" | "roadmap";

export type DatabaseTemplate = {
  id: DatabaseTemplateId;
  label: string;
  title: string;
};

export const DATABASE_TEMPLATES: DatabaseTemplate[] = [
  { id: "tasks", label: "Task tracker", title: "Tasks" },
  { id: "contacts", label: "Contacts", title: "Contacts" },
  { id: "roadmap", label: "Roadmap", title: "Roadmap" },
];

export function getDatabaseTemplate(id: string) {
  return DATABASE_TEMPLATES.find((t) => t.id === id) ?? DATABASE_TEMPLATES[0];
}

function previewScene(
  title: string,
  properties: DatabaseProperty[],
  rows: DatabaseRowData[]
): DatabaseScene {
  return {
    id: "template-preview",
    title,
    folderId: null,
    libraryId: "",
    properties,
    rows,
    views: [],
  };
}

function select(id: string, label: string, color: SelectOption["color"]): SelectOption {
  return { id, label, color };
}

/** Table thumbnail data for template cards — mirrors seeded database content. */
export function buildDatabaseTemplatePreviewScene(id: DatabaseTemplateId): DatabaseScene {
  switch (id) {
    case "contacts": {
      const name: DatabaseProperty = {
        id: "name",
        name: "Name",
        type: "TEXT",
        options: [],
        position: 0,
      };
      const email: DatabaseProperty = {
        id: "email",
        name: "Email",
        type: "TEXT",
        options: [],
        position: 1,
      };
      const company: DatabaseProperty = {
        id: "company",
        name: "Company",
        type: "TEXT",
        options: [],
        position: 2,
      };
      return previewScene("Contacts", [name, email, company], [
        {
          id: "r1",
          position: 0,
          cells: {
            name: "Morgan Chen",
            email: "morgan@design.co",
            company: "Studio North",
          },
        },
        {
          id: "r2",
          position: 1,
          cells: { name: "Priya Patel", email: "priya@acme.io", company: "Acme" },
        },
        {
          id: "r3",
          position: 2,
          cells: { name: "Alex Kim", email: "alex@example.com", company: "Acme" },
        },
      ]);
    }
    case "roadmap": {
      const feature: DatabaseProperty = {
        id: "feature",
        name: "Feature",
        type: "TEXT",
        options: [],
        position: 0,
      };
      const status: DatabaseProperty = {
        id: "status",
        name: "Status",
        type: "SELECT",
        options: [
          select("planned", "Planned", "gray"),
          select("ip", "In progress", "blue"),
          select("shipped", "Shipped", "green"),
        ],
        position: 1,
      };
      const quarter: DatabaseProperty = {
        id: "quarter",
        name: "Quarter",
        type: "SELECT",
        options: [
          select("q1", "Q1", "blue"),
          select("q2", "Q2", "purple"),
          select("q3", "Q3", "orange"),
        ],
        position: 2,
      };
      return previewScene("Roadmap", [feature, status, quarter], [
        {
          id: "r1",
          position: 0,
          cells: { feature: "Native app homes", status: "shipped", quarter: "q1" },
        },
        {
          id: "r2",
          position: 1,
          cells: { feature: "Template gallery", status: "ip", quarter: "q2" },
        },
        {
          id: "r3",
          position: 2,
          cells: { feature: "Billing v1", status: "planned", quarter: "q2" },
        },
      ]);
    }
    case "tasks":
    default: {
      const name: DatabaseProperty = {
        id: "name",
        name: "Name",
        type: "TEXT",
        options: [],
        position: 0,
      };
      const status: DatabaseProperty = {
        id: "status",
        name: "Status",
        type: "SELECT",
        options: [
          select("todo", "Todo", "gray"),
          select("ip", "In progress", "blue"),
          select("blocked", "Blocked", "red"),
          select("done", "Done", "green"),
        ],
        position: 1,
      };
      const due: DatabaseProperty = {
        id: "due",
        name: "Due",
        type: "DATE",
        options: [],
        position: 2,
      };
      return previewScene("Tasks", [name, status, due], [
        {
          id: "r1",
          position: 0,
          cells: { name: "Polish template thumbnails", status: "ip" },
        },
        {
          id: "r2",
          position: 1,
          cells: { name: "Write launch checklist", status: "todo" },
        },
        {
          id: "r3",
          position: 2,
          cells: { name: "Billing integration QA", status: "todo" },
        },
        {
          id: "r4",
          position: 3,
          cells: { name: "Send beta invites", status: "blocked" },
        },
      ]);
    }
  }
}
