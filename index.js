#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_BASE = process.env.API_BASE;
if (!API_BASE) {
  throw new Error("API_BASE environment variable is required");
}

// Create server instance
const server = new Server(
  {
    name: "tasks-api-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "add_task",
        description: "Creates a new to-do item on the list. Requires the name parameter.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The concise title of the task to be added.",
            },
            description: {
              type: "string",
              description: "The brief summary of the task.",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "list_tasks",
        description: "Retrieves tasks, allowing for filtering and sorting via PocketBase query syntax. Use 'filter' for specific criteria (e.g., pending tasks).",
        inputSchema: {
          type: "object",
          properties: {
            filter: {
              type: "string",
              description: "PocketBase filter string to select specific records (e.g., (done=false) for pending tasks). Use parentheses for conditions.",
            },
            sort: {
              type: "string",
              description: "PocketBase sort string for ordering results (e.g., '-created' for newest first, 'name' for alphabetical).",
            },
            page: {
              type: "integer",
              description: "The page number for paginated results (defaults to 1).",
            },
          },
          required: [],
        },
      },
      {
        name: "update_task",
        description: "Updates the task identified by task_id. Allows changing name, description, done, or archived status.",
        inputSchema: {
          type: "object",
          properties: {
            task_id: {
              type: "string",
              description: "The ID of the task to be updated.",
            },
            name: {
              type: "string",
              description: "The new title of the task.",
            },
            description: {
              type: "string",
              description: "The new description of the task.",
            },
            done: {
              type: "boolean",
              description: "A flag that indicates if the task is done.",
            },
            archived: {
              type: "boolean",
              description: "A flag that specifies if the task is archived.",
            },
          },
          required: ["task_id"],
        },
      },
      {
        name: "delete_task",
        description: "Removes a specific task from the list using its ID.",
        inputSchema: {
          type: "object",
          properties: {
            task_id: {
              type: "string",
              description: "The ID of the task to be deleted.",
            },
          },
          required: ["task_id"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "add_task": {
        const response = await fetch(API_BASE, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: args.name,
            description: args.description,
          }),
        });

        const data = await response.json();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "list_tasks": {
        const params = new URLSearchParams();
        if (args.filter) params.append("filter", args.filter);
        if (args.sort) params.append("sort", args.sort);
        if (args.page) params.append("page", args.page.toString());

        const url = params.toString() ? `${API_BASE}?${params}` : API_BASE;
        const response = await fetch(url);
        const data = await response.json();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "update_task": {
        const { task_id, ...updateData } = args;
        const response = await fetch(`${API_BASE}/${task_id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        });

        const data = await response.json();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "delete_task": {
        const response = await fetch(`${API_BASE}/${args.task_id}`, {
          method: "DELETE",
        });

        return {
          content: [
            {
              type: "text",
              text: response.ok 
                ? `Task ${args.task_id} deleted successfully`
                : `Failed to delete task ${args.task_id}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Tasks API MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
