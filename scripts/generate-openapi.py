#!/usr/bin/env python3
"""Generate public/openapi.json with all endpoint docs."""
import json

def schema_obj(props, required=None):
    return {"type": "object", "properties": props, "required": required or list(props.keys())}

def pagination_props():
    return {
        "page": {"type": "integer", "description": "Current page number (starts at 1)"},
        "limit": {"type": "integer", "description": "Items per page"},
        "total": {"type": "integer", "description": "Total items matching the query"},
        "total_pages": {"type": "integer", "description": "Total number of pages"},
    }

def error_schema():
    return {
        "type": "object",
        "properties": {
            "error": {"type": "string", "description": "Machine-readable error code"},
            "message": {"type": "string", "description": "Human-readable error description"},
        },
    }

def resp(content_schema=None, example=None):
    d = {"description": "OK"}
    if content_schema or example:
        body = {}
        if content_schema:
            body["schema"] = content_schema
        if example:
            body["example"] = example
        d["content"] = {"application/json": body}
    return d

def error_resp(desc, example=None):
    d = {"description": desc}
    d["content"] = {"application/json": {"schema": error_schema(), "example": example or {"error": desc.lower().replace(" ", "_"), "message": desc}}}
    return d

inspiration_request_props = {
    "id": {"type": "string", "format": "uuid", "description": "Inspiration request UUID"},
    "user_id": {"type": "string", "format": "uuid", "description": "Creator user UUID"},
    "title": {"type": "string", "description": "Idea title"},
    "description": {"type": "string", "description": "Detailed description"},
    "type": {"type": "string", "description": "Request type: bug, improvement, new_app, etc."},
    "status": {"type": "string", "description": "Current status: pending, reviewing, approved, etc."},
    "app_slug": {"type": "string", "description": "Related app slug, if any"},
    "created_at": {"type": "string", "format": "date-time", "description": "ISO 8601 creation timestamp"},
    "vote_count": {"type": "integer", "description": "Total votes"},
    "comment_count": {"type": "integer", "description": "Total comments"},
    "user_has_voted": {"type": "boolean", "description": "Whether the current user has voted"},
    "creator": {
        "type": "object",
        "properties": {
            "display_name": {"type": "string", "description": "Creator's display name"},
            "avatar_url": {"type": "string", "description": "Creator's avatar URL"},
        },
    },
}

comment_props = {
    "id": {"type": "string", "format": "uuid", "description": "Comment UUID"},
    "request_id": {"type": "string", "format": "uuid", "description": "Parent inspiration request UUID"},
    "user_id": {"type": "string", "format": "uuid", "description": "Author user UUID"},
    "body": {"type": "string", "description": "Comment text"},
    "created_at": {"type": "string", "format": "date-time", "description": "ISO 8601 creation timestamp"},
    "user": {
        "type": "object",
        "properties": {
            "display_name": {"type": "string", "description": "Author's display name"},
            "avatar_url": {"type": "string", "description": "Author's avatar URL"},
        },
    },
}

bearer_auth = [{"bearerAuth": []}]
any_auth = [{"bearerAuth": []}, {"apiKey": []}]

paths = {
    # ── Health ──────────────────────────────────────────────
    "/api/v1": {
        "get": {
            "summary": "Health check",
            "description": "Returns the API version and status. No authentication required.",
            "tags": ["Health"],
            "parameters": [],
            "responses": {
                "200": resp(
                    schema_obj({"version": {"type": "string", "enum": ["v1"], "description": "API version"}, "status": {"type": "string", "enum": ["ok"], "description": "Service status"}}),
                    {"version": "v1", "status": "ok"},
                ),
            },
        },
    },

    # ── Admin - API Keys ───────────────────────────────────
    "/api/v1/admin/api-keys": {
        "get": {
            "tags": ["Admin - API Keys"],
            "summary": "List API keys",
            "description": "Returns a paginated list of API keys (masked values). Requires admin role.",
            "parameters": [
                {"name": "page", "in": "query", "schema": {"type": "integer", "default": 1}},
                {"name": "limit", "in": "query", "schema": {"type": "integer", "default": 20, "maximum": 500}},
            ],
            "responses": {
                "200": {"description": "Paginated API key list"},
                "401": error_resp("Unauthorized"),
                "403": error_resp("Forbidden", {"error": "forbidden", "message": "Admin access required"}),
            },
            "security": bearer_auth,
        },
        "post": {
            "tags": ["Admin - API Keys"],
            "summary": "Create API key",
            "description": "Creates a new API key. The full key is returned only once in the response. Requires admin role.",
            "requestBody": {"required": True, "content": {"application/json": {"schema": schema_obj({"name": {"type": "string", "description": "Label for the API key"}}, ["name"])}}},
            "responses": {
                "201": {"description": "API key created (full key returned once)"},
                "401": error_resp("Unauthorized"),
                "403": error_resp("Forbidden"),
                "422": error_resp("Validation error"),
            },
            "security": bearer_auth,
        },
    },
    "/api/v1/admin/api-keys/{id}": {
        "delete": {
            "tags": ["Admin - API Keys"],
            "summary": "Revoke API key",
            "description": "Revokes an API key. Requires admin role. Returns 204 on success.",
            "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "string", "format": "uuid"}, "description": "API key UUID"}],
            "responses": {
                "204": {"description": "No Content — revoked successfully"},
                "401": error_resp("Unauthorized"),
                "403": error_resp("Forbidden"),
                "404": error_resp("Not found"),
            },
            "security": bearer_auth,
        },
    },

    # ── Admin - Inspiration ─────────────────────────────────
    "/api/v1/admin/apps/inspiration": {
        "get": {
            "summary": "List all inspiration requests (admin)",
            "description": "Returns paginated inspiration requests with filters. Requires admin role.",
            "tags": ["Admin - Inspiration"],
            "parameters": [
                {"name": "status", "in": "query", "schema": {"type": "string"}, "description": "Filter by status (comma-separated): pending, reviewing, approved, in_progress, completed, rejected, on_hold, duplicate"},
                {"name": "type", "in": "query", "schema": {"type": "string"}, "description": "Filter by type (comma-separated): bug, improvement, new_app, new_app_feature, new_general_functionality, other"},
                {"name": "search", "in": "query", "schema": {"type": "string"}, "description": "Search text in title and description (case-insensitive)"},
                {"name": "sort", "in": "query", "schema": {"type": "string", "enum": ["newest", "oldest", "most_supported", "most_commented"], "default": "newest"}, "description": "Sort order"},
                {"name": "app_slug", "in": "query", "schema": {"type": "string"}, "description": "Filter by related app slug"},
                {"name": "group_slug", "in": "query", "schema": {"type": "string"}, "description": "Filter by group slug"},
                {"name": "my", "in": "query", "schema": {"type": "string", "enum": ["1"]}, "description": 'Set to "1" to show only your items'},
                {"name": "page", "in": "query", "schema": {"type": "integer", "default": 1, "minimum": 1}, "description": "Page number (starts at 1)"},
                {"name": "limit", "in": "query", "schema": {"type": "integer", "default": 20, "minimum": 1, "maximum": 500}, "description": "Number of items per page"},
            ],
            "responses": {
                "200": resp(
                    schema_obj({
                        "data": {"type": "array", "items": schema_obj(inspiration_request_props), "description": "Array of inspiration requests"},
                        "pagination": schema_obj(pagination_props()),
                    }),
                    {"data": [{"id": "uuid", "title": "Add dark mode", "type": "improvement", "status": "pending", "vote_count": 5, "comment_count": 2}], "pagination": {"page": 1, "limit": 20, "total": 1, "total_pages": 1}},
                ),
                "401": error_resp("Unauthorized"),
                "403": error_resp("Forbidden", {"error": "forbidden", "message": "Admin access required"}),
            },
            "security": bearer_auth,
        },
    },
    "/api/v1/admin/apps/inspiration/{id}": {
        "get": {
            "summary": "Get inspiration request details (admin)",
            "description": "Returns a single request with vote/comment counts and creator info.",
            "tags": ["Admin - Inspiration"],
            "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "string", "format": "uuid"}, "description": "Inspiration request UUID"}],
            "responses": {
                "200": resp(schema_obj(inspiration_request_props)),
                "401": error_resp("Unauthorized"),
                "403": error_resp("Forbidden"),
                "404": error_resp("Not found", {"error": "not_found", "message": "Request not found"}),
            },
            "security": bearer_auth,
        },
        "put": {
            "summary": "Update inspiration request (admin)",
            "description": "Admin can change status; creator can update title/description.",
            "tags": ["Admin - Inspiration"],
            "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "string", "format": "uuid"}, "description": "Inspiration request UUID"}],
            "requestBody": {"required": True, "content": {"application/json": {"schema": {"type": "object", "properties": {
                "title": {"type": "string", "description": "New title for the request"},
                "description": {"type": "string", "description": "New description"},
                "status": {"type": "string", "description": "New status (admin only): approved, rejected, completed, etc."},
            }}, "example": {"status": "approved"}}}},
            "responses": {
                "200": resp({"type": "object", "properties": {"id": {"type": "string", "description": "Inspiration request UUID"}, "status": {"type": "string", "description": "Updated status"}}}),
                "401": error_resp("Unauthorized"),
                "403": error_resp("Forbidden"),
                "404": error_resp("Not found"),
            },
            "security": bearer_auth,
        },
        "delete": {
            "summary": "Delete inspiration request (admin)",
            "description": "Permanently deletes a request. Requires admin role. Returns 204 on success.",
            "tags": ["Admin - Inspiration"],
            "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "string", "format": "uuid"}, "description": "Inspiration request UUID"}],
            "responses": {
                "204": {"description": "No Content — deleted successfully"},
                "401": error_resp("Unauthorized"),
                "403": error_resp("Forbidden"),
                "404": error_resp("Not found"),
            },
            "security": bearer_auth,
        },
    },

    # ── Admin - Invitations ─────────────────────────────────
    "/api/v1/admin/invitations": {
        "get": {
            "tags": ["Admin - Invitations"],
            "summary": "List invitations",
            "description": "Returns a paginated list of invitations. Requires admin role.",
            "parameters": [
                {"name": "page", "in": "query", "schema": {"type": "integer", "default": 1}},
                {"name": "limit", "in": "query", "schema": {"type": "integer", "default": 20, "maximum": 500}},
            ],
            "responses": {
                "200": {"description": "Paginated invitation list"},
                "401": error_resp("Unauthorized"),
                "403": error_resp("Forbidden", {"error": "forbidden", "message": "Admin access required"}),
            },
            "security": bearer_auth,
        },
        "post": {
            "tags": ["Admin - Invitations"],
            "summary": "Create invitation",
            "description": "Creates a new invitation link/code. Requires admin role.",
            "responses": {
                "201": {"description": "Invitation created"},
                "401": error_resp("Unauthorized"),
                "403": error_resp("Forbidden"),
                "422": error_resp("Validation error"),
            },
            "security": bearer_auth,
        },
    },
    "/api/v1/admin/invitations/{id}": {
        "delete": {
            "tags": ["Admin - Invitations"],
            "summary": "Delete invitation",
            "description": "Deletes an invitation. Requires admin role. Returns 204 on success.",
            "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "string", "format": "uuid"}, "description": "Invitation UUID"}],
            "responses": {
                "204": {"description": "No Content — deleted successfully"},
                "401": error_resp("Unauthorized"),
                "403": error_resp("Forbidden"),
                "404": error_resp("Not found"),
            },
            "security": bearer_auth,
        },
    },

    # ── Admin - Settings ────────────────────────────────────
    "/api/v1/admin/settings": {
        "get": {
            "tags": ["Admin - Settings"],
            "summary": "Get group settings",
            "description": "Returns the group settings. Requires admin role.",
            "responses": {
                "200": {"description": "Group settings"},
                "401": error_resp("Unauthorized"),
                "403": error_resp("Forbidden", {"error": "forbidden", "message": "Admin access required"}),
            },
            "security": bearer_auth,
        },
        "put": {
            "tags": ["Admin - Settings"],
            "summary": "Update group settings",
            "description": "Updates group settings. Requires admin role.",
            "requestBody": {"required": True, "content": {"application/json": {"schema": schema_obj({
                "group_name": {"type": "string", "description": "Group display name"},
                "default_locale": {"type": "string", "description": "Default locale for the group (e.g. en, es)"},
            })}}},
            "responses": {
                "200": {"description": "Settings updated"},
                "401": error_resp("Unauthorized"),
                "403": error_resp("Forbidden"),
            },
            "security": bearer_auth,
        },
    },

    # ── Admin - Todo ────────────────────────────────────────
    "/api/v1/admin/apps/todo": {
        "get": {
            "summary": "List all todo items (admin)",
            "description": "Returns all todo items across all groups. Requires admin role.",
            "tags": ["Admin - Todo"],
            "parameters": [],
            "responses": {
                "200": resp(
                    {"type": "array", "items": schema_obj({
                        "id": {"type": "integer", "description": "Todo item ID"},
                        "title": {"type": "string", "description": "Todo title"},
                        "completed": {"type": "boolean", "description": "Whether completed"},
                        "user_id": {"type": "string", "format": "uuid", "description": "Owner user UUID"},
                        "group_id": {"type": "string", "format": "uuid", "description": "Group UUID"},
                        "created_at": {"type": "string", "format": "date-time", "description": "ISO 8601 creation timestamp"},
                        "visibility": {"type": "string", "description": "Visibility: public or private"},
                    })},
                    [{"id": 1, "title": "Buy groceries", "completed": False, "user_id": "uuid", "group_id": "uuid", "created_at": "2025-01-15T10:30:00Z", "visibility": "public"}],
                ),
                "401": error_resp("Unauthorized"),
                "403": error_resp("Forbidden", {"error": "forbidden", "message": "Admin access required"}),
            },
            "security": bearer_auth,
        },
    },

    # ── Admin - Users ───────────────────────────────────────
    "/api/v1/admin/users": {
        "get": {
            "tags": ["Admin - Users"],
            "summary": "List users",
            "description": "Returns a paginated list of users in the group. Requires admin role.",
            "parameters": [
                {"name": "page", "in": "query", "schema": {"type": "integer", "default": 1}},
                {"name": "limit", "in": "query", "schema": {"type": "integer", "default": 20, "maximum": 500}},
                {"name": "search", "in": "query", "schema": {"type": "string"}, "description": "Filter by email or display name"},
            ],
            "responses": {
                "200": {"description": "Paginated user list"},
                "401": error_resp("Unauthorized"),
                "403": error_resp("Forbidden", {"error": "forbidden", "message": "Admin access required"}),
            },
            "security": bearer_auth,
        },
    },
    "/api/v1/admin/users/{id}": {
        "get": {
            "tags": ["Admin - Users"],
            "summary": "Get user detail",
            "description": "Returns a single user's details. Requires admin role.",
            "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "string", "format": "uuid"}, "description": "User UUID"}],
            "responses": {
                "200": {"description": "User detail"},
                "401": error_resp("Unauthorized"),
                "403": error_resp("Forbidden"),
                "404": error_resp("Not found"),
            },
            "security": bearer_auth,
        },
        "put": {
            "tags": ["Admin - Users"],
            "summary": "Update user",
            "description": "Update a user's role, profile, or block status. Requires admin role.",
            "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "string", "format": "uuid"}, "description": "User UUID"}],
            "requestBody": {"required": True, "content": {"application/json": {"schema": schema_obj({
                "role": {"type": "string", "enum": ["admin", "member"], "description": "User role"},
                "display_name": {"type": "string", "description": "Display name"},
                "locale": {"type": "string", "description": "Preferred locale (e.g. en, es)"},
                "blocked": {"type": "boolean", "description": "Whether the user is blocked"},
            })}}},
            "responses": {
                "200": {"description": "User updated"},
                "401": error_resp("Unauthorized"),
                "403": error_resp("Forbidden"),
                "404": error_resp("Not found"),
            },
            "security": bearer_auth,
        },
        "delete": {
            "tags": ["Admin - Users"],
            "summary": "Delete user",
            "description": "Permanently removes a user from the group. Requires admin role. Returns 204 on success.",
            "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "string", "format": "uuid"}, "description": "User UUID"}],
            "responses": {
                "204": {"description": "No Content — deleted successfully"},
                "401": error_resp("Unauthorized"),
                "403": error_resp("Forbidden"),
                "404": error_resp("Not found"),
            },
            "security": bearer_auth,
        },
    },

    # ── Apps ────────────────────────────────────────────────
    "/api/v1/apps": {
        "get": {
            "summary": "List installed apps",
            "description": "Returns all active installed apps for the authenticated group.",
            "tags": ["Apps"],
            "parameters": [],
            "responses": {
                "200": resp(
                    {"type": "array", "items": schema_obj({
                        "slug": {"type": "string", "description": "Unique app identifier"},
                        "name": {"type": "string", "description": "App display name"},
                        "description": {"type": "string", "description": "Short app description"},
                        "icon_url": {"type": "string", "description": "App icon URL"},
                        "status": {"type": "string", "description": "Installation status: active, inactive, error"},
                        "visibility": {"type": "string", "description": "App visibility: public or private"},
                    })},
                    [{"slug": "todo", "name": "Tasks", "description": "Simple task manager", "icon_url": "/api/apps/todo/logo", "status": "active", "visibility": "public"}],
                ),
                "401": error_resp("Unauthorized"),
            },
            "security": any_auth,
        },
    },
    "/api/v1/apps/{slug}/logo": {
        "get": {
            "summary": "Get app logo",
            "description": "Returns the logo SVG/PNG for a specific app.",
            "tags": ["Apps"],
            "parameters": [{"name": "slug", "in": "path", "required": True, "schema": {"type": "string"}, "description": "App slug"}],
            "responses": {
                "200": {"description": "Logo image (SVG or PNG)", "content": {"image/svg+xml": {"schema": {"type": "string", "format": "binary"}}, "image/png": {"schema": {"type": "string", "format": "binary"}}}},
                "404": error_resp("Not found"),
            },
        },
    },

    # ── Inspiration (group proxy) ───────────────────────────
    "/api/v1/{group}/apps/inspiration": {
        "get": {
            "summary": "List inspiration ideas",
            "description": "Returns paginated inspiration requests for the group with vote/comment counts and creator info.",
            "tags": ["App - Inspiration - Ideas"],
            "parameters": [
                {"name": "group", "in": "path", "required": True, "schema": {"type": "string"}, "description": "Group slug"},
                {"name": "status", "in": "query", "schema": {"type": "string"}, "description": "Filter by status(es), comma-separated"},
                {"name": "type", "in": "query", "schema": {"type": "string"}, "description": "Filter by type(s), comma-separated"},
                {"name": "search", "in": "query", "schema": {"type": "string"}, "description": "Search text in title and description"},
                {"name": "sort", "in": "query", "schema": {"type": "string", "enum": ["newest", "oldest", "most_supported", "most_commented"], "default": "newest"}, "description": "Sort order"},
                {"name": "app_slug", "in": "query", "schema": {"type": "string"}, "description": "Filter by related app slug"},
                {"name": "my", "in": "query", "schema": {"type": "string", "enum": ["1"]}, "description": 'Set to "1" to show only your items'},
                {"name": "page", "in": "query", "schema": {"type": "integer", "default": 1, "minimum": 1}, "description": "Page number (starts at 1)"},
                {"name": "limit", "in": "query", "schema": {"type": "integer", "default": 20, "minimum": 1, "maximum": 500}, "description": "Items per page"},
            ],
            "responses": {
                "200": resp(
                    schema_obj({
                        "data": {"type": "array", "items": schema_obj(inspiration_request_props), "description": "Array of inspiration requests"},
                        "pagination": schema_obj(pagination_props()),
                    }),
                    {"data": [{"id": "uuid", "title": "Add dark mode", "description": "Please add dark mode", "type": "improvement", "status": "pending", "vote_count": 5, "comment_count": 2, "user_has_voted": False, "creator": {"display_name": "Alice", "avatar_url": None}}], "pagination": {"page": 1, "limit": 20, "total": 1, "total_pages": 1}},
                ),
                "401": error_resp("Unauthorized"),
            },
            "security": bearer_auth,
        },
        "post": {
            "summary": "Create an inspiration idea",
            "description": "Creates a new inspiration request for the group. Authenticated members.",
            "tags": ["App - Inspiration - Ideas"],
            "parameters": [{"name": "group", "in": "path", "required": True, "schema": {"type": "string"}, "description": "Group slug"}],
            "requestBody": {"required": True, "content": {"application/json": {"schema": schema_obj({
                "title": {"type": "string", "description": "Idea title (required)"},
                "description": {"type": "string", "description": "Detailed description of the idea"},
                "type": {"type": "string", "enum": ["bug", "improvement", "new_app", "new_app_feature", "new_general_functionality", "other"], "description": "Type of request (required)"},
                "app_slug": {"type": "string", "description": "Slug of the related app (optional)"},
            }, ["title", "type"]), "example": {"title": "Add dark mode", "description": "Please add a dark mode toggle", "type": "improvement", "app_slug": "todo"}}}},
            "responses": {
                "201": resp(schema_obj({
                    "id": {"type": "string", "format": "uuid", "description": "New inspiration request UUID"},
                    "user_id": {"type": "string", "format": "uuid", "description": "Creator user UUID"},
                    "title": {"type": "string", "description": "Submitted title"},
                    "type": {"type": "string", "description": "Request type"},
                    "status": {"type": "string", "description": "Initial status (pending)"},
                    "created_at": {"type": "string", "format": "date-time", "description": "ISO 8601 creation timestamp"},
                })),
                "401": error_resp("Unauthorized"),
                "422": error_resp("Validation error", {"error": "validation_failed", "message": "Title is required"}),
            },
            "security": bearer_auth,
        },
    },
    "/api/v1/{group}/apps/inspiration/apps": {
        "get": {
            "summary": "List apps available for inspiration",
            "description": "Returns installed apps that can be assigned to an inspiration request.",
            "tags": ["App - Inspiration - Ideas"],
            "parameters": [{"name": "group", "in": "path", "required": True, "schema": {"type": "string"}, "description": "Group slug"}],
            "responses": {
                "200": resp(schema_obj({"apps": {"type": "array", "items": schema_obj({"slug": {"type": "string", "description": "App slug"}, "name": {"type": "string", "description": "App display name"}}), "description": "Available apps for assignment"}})),
                "401": error_resp("Unauthorized"),
            },
            "security": bearer_auth,
        },
    },
    "/api/v1/{group}/apps/inspiration/{id}": {
        "put": {
            "summary": "Update an inspiration idea",
            "description": "Updates title/description (creator) or status (admin).",
            "tags": ["App - Inspiration - Ideas"],
            "parameters": [
                {"name": "group", "in": "path", "required": True, "schema": {"type": "string"}, "description": "Group slug"},
                {"name": "id", "in": "path", "required": True, "schema": {"type": "string", "format": "uuid"}, "description": "Inspiration request UUID"},
            ],
            "requestBody": {"required": True, "content": {"application/json": {"schema": schema_obj({
                "title": {"type": "string", "description": "New title"},
                "description": {"type": "string", "description": "New description"},
                "status": {"type": "string", "description": "New status (admin only)"},
            }), "example": {"status": "approved"}}}},
            "responses": {
                "200": resp(schema_obj({"id": {"type": "string", "description": "Inspiration request UUID"}, "status": {"type": "string", "description": "Updated status"}})),
                "401": error_resp("Unauthorized"),
                "403": error_resp("Forbidden"),
                "404": error_resp("Not found"),
            },
            "security": bearer_auth,
        },
        "delete": {
            "summary": "Delete an inspiration idea",
            "description": "Deletes a request. Creator or admin. Returns 204 on success.",
            "tags": ["App - Inspiration - Ideas"],
            "parameters": [
                {"name": "group", "in": "path", "required": True, "schema": {"type": "string"}, "description": "Group slug"},
                {"name": "id", "in": "path", "required": True, "schema": {"type": "string", "format": "uuid"}, "description": "Inspiration request UUID"},
            ],
            "responses": {
                "204": {"description": "No Content — deleted successfully"},
                "401": error_resp("Unauthorized"),
                "403": error_resp("Forbidden"),
                "404": error_resp("Not found"),
            },
            "security": bearer_auth,
        },
    },
    "/api/v1/{group}/apps/inspiration/{id}/comments": {
        "get": {
            "summary": "List comments for an idea",
            "description": "Returns paginated comments for an inspiration request, enriched with author info.",
            "tags": ["App - Inspiration - Comments"],
            "parameters": [
                {"name": "group", "in": "path", "required": True, "schema": {"type": "string"}, "description": "Group slug"},
                {"name": "id", "in": "path", "required": True, "schema": {"type": "string", "format": "uuid"}, "description": "Inspiration request UUID"},
                {"name": "page", "in": "query", "schema": {"type": "integer", "default": 1, "minimum": 1}, "description": "Page number (starts at 1)"},
                {"name": "limit", "in": "query", "schema": {"type": "integer", "default": 20, "minimum": 1, "maximum": 500}, "description": "Comments per page"},
            ],
            "responses": {
                "200": resp(
                    schema_obj({
                        "data": {"type": "array", "items": schema_obj(comment_props), "description": "Array of comments"},
                        "pagination": schema_obj(pagination_props()),
                    }),
                    {"data": [{"id": "uuid", "request_id": "uuid", "user_id": "uuid", "body": "Great idea!", "created_at": "2025-01-15T11:00:00Z", "user": {"display_name": "Bob", "avatar_url": None}}], "pagination": {"page": 1, "limit": 20, "total": 1, "total_pages": 1}},
                ),
                "401": error_resp("Unauthorized"),
            },
            "security": bearer_auth,
        },
        "post": {
            "summary": "Add a comment to an idea",
            "description": "Adds a comment to an inspiration request. Authenticated members.",
            "tags": ["App - Inspiration - Comments"],
            "parameters": [
                {"name": "group", "in": "path", "required": True, "schema": {"type": "string"}, "description": "Group slug"},
                {"name": "id", "in": "path", "required": True, "schema": {"type": "string", "format": "uuid"}, "description": "Inspiration request UUID"},
            ],
            "requestBody": {"required": True, "content": {"application/json": {"schema": schema_obj({"body": {"type": "string", "description": "Comment text (required)"}}, ["body"]), "example": {"body": "Great idea! I fully support this."}}}},
            "responses": {
                "201": resp(schema_obj(comment_props)),
                "401": error_resp("Unauthorized"),
                "404": error_resp("Not found"),
            },
            "security": bearer_auth,
        },
    },
    "/api/v1/{group}/apps/inspiration/{id}/vote": {
        "post": {
            "summary": "Vote/unvote on an idea",
            "description": "Toggles your vote on an inspiration request. Vote if not voted, unvote if already voted.",
            "tags": ["App - Inspiration - Votes"],
            "parameters": [
                {"name": "group", "in": "path", "required": True, "schema": {"type": "string"}, "description": "Group slug"},
                {"name": "id", "in": "path", "required": True, "schema": {"type": "string", "format": "uuid"}, "description": "Inspiration request UUID"},
            ],
            "responses": {
                "200": resp(schema_obj({
                    "voted": {"type": "boolean", "description": "Whether the vote is active (true) or removed (false)"},
                    "vote_count": {"type": "integer", "description": "Updated total vote count"},
                }), {"voted": True, "vote_count": 6}),
                "401": error_resp("Unauthorized"),
                "404": error_resp("Not found"),
            },
            "security": bearer_auth,
        },
    },
    # ── Locales ─────────────────────────────────────────────
    "/api/v1/locales": {
        "get": {
            "summary": "List active locales",
            "description": "Returns the active locales configured for the group, with display names and default flag.",
            "tags": ["Locales"],
            "parameters": [],
            "responses": {
                "200": resp(
                    {"type": "array", "items": schema_obj({
                        "code": {"type": "string", "description": "Locale code (e.g. en, es, ca)"},
                        "name": {"type": "string", "description": "Locale display name in native language"},
                        "is_default": {"type": "boolean", "description": "Whether this is the default locale"},
                    })},
                    [{"code": "en", "name": "English", "is_default": False}, {"code": "es", "name": "Espa\u00f1ol", "is_default": True}],
                ),
            },
        },
    },

    # ── Profile ─────────────────────────────────────────────
    "/api/v1/me": {
        "get": {
            "summary": "Get current user profile",
            "description": "Returns the authenticated user's profile including display name, avatar, locale, role, and group membership.",
            "tags": ["Profile"],
            "parameters": [],
            "responses": {
                "200": resp(schema_obj({
                    "id": {"type": "string", "format": "uuid", "description": "User UUID"},
                    "email": {"type": "string", "format": "email", "description": "User email address"},
                    "display_name": {"type": "string", "description": "Public display name"},
                    "avatar_url": {"type": "string", "description": "Avatar image URL"},
                    "locale": {"type": "string", "description": "Preferred locale code (e.g. es, en)"},
                    "role": {"type": "string", "description": "User role: admin or member"},
                    "group_id": {"type": "string", "format": "uuid", "description": "Primary group UUID"},
                }), {
                    "id": "550e8400-e29b-41d4-a716-446655440000",
                    "email": "alice@example.com",
                    "display_name": "Alice",
                    "avatar_url": "https://example.com/avatar.png",
                    "locale": "es",
                    "role": "admin",
                    "group_id": "550e8400-e29b-41d4-a716-446655440001",
                }),
                "401": error_resp("Unauthorized"),
                "403": error_resp("Forbidden"),
            },
            "security": bearer_auth,
        },
    },

    # ── Shared ──────────────────────────────────────────────
    "/api/v1/shared/config": {
        "get": {
            "tags": ["Shared"],
            "summary": "Get group public config",
            "description": "Returns the group's public configuration (name, default locale, enabled features, etc.).",
            "responses": {
                "200": {"description": "Group public config"},
                "401": error_resp("Unauthorized"),
            },
            "security": bearer_auth,
        },
    },
    "/api/v1/shared/profile": {
        "get": {
            "tags": ["Shared"],
            "summary": "Get authenticated user profile",
            "description": "Returns the authenticated user's profile.",
            "responses": {
                "200": {"description": "User profile"},
                "401": error_resp("Unauthorized"),
            },
            "security": bearer_auth,
        },
        "put": {
            "tags": ["Shared"],
            "summary": "Update own profile",
            "description": "Updates the authenticated user's own profile.",
            "requestBody": {"required": True, "content": {"application/json": {"schema": schema_obj({
                "display_name": {"type": "string", "description": "Display name"},
                "locale": {"type": "string", "description": "Preferred locale (e.g. en, es)"},
                "avatar_url": {"type": "string", "description": "Avatar image URL"},
            })}}},
            "responses": {
                "200": {"description": "Profile updated"},
                "401": error_resp("Unauthorized"),
            },
            "security": bearer_auth,
        },
    },

    # ── Todo (group proxy) ──────────────────────────────────
    "/api/v1/{group}/apps/todo": {
        "get": {
            "summary": "List todo items",
            "description": "Returns todo items for the group.",
            "tags": ["App - Todo - Items"],
            "parameters": [{"name": "group", "in": "path", "required": True, "schema": {"type": "string"}, "description": "Group slug"}],
            "responses": {
                "200": resp(
                    {"type": "array", "items": schema_obj({
                        "id": {"type": "integer", "description": "Todo item ID"},
                        "title": {"type": "string", "description": "Todo title"},
                        "completed": {"type": "boolean", "description": "Whether completed"},
                        "created_at": {"type": "string", "format": "date-time", "description": "ISO 8601 creation timestamp"},
                    })},
                    [{"id": 1, "title": "Buy groceries", "completed": False, "created_at": "2025-01-15T10:30:00Z"}],
                ),
                "401": error_resp("Unauthorized"),
            },
            "security": any_auth,
        },
        "post": {
            "summary": "Create a todo item",
            "description": "Creates a new todo item in the group.",
            "tags": ["App - Todo - Items"],
            "parameters": [{"name": "group", "in": "path", "required": True, "schema": {"type": "string"}, "description": "Group slug"}],
            "requestBody": {"required": True, "content": {"application/json": {"schema": schema_obj({"title": {"type": "string", "description": "Todo title (required)"}}, ["title"]), "example": {"title": "Buy groceries"}}}},
            "responses": {
                "201": resp(schema_obj({
                    "id": {"type": "integer", "description": "New todo item ID"},
                    "title": {"type": "string", "description": "Todo title"},
                    "completed": {"type": "boolean", "description": "Whether completed"},
                    "created_at": {"type": "string", "format": "date-time", "description": "ISO 8601 creation timestamp"},
                })),
                "401": error_resp("Unauthorized"),
            },
            "security": bearer_auth,
        },
    },
    "/api/v1/{group}/apps/todo/{id}": {
        "put": {
            "summary": "Update a todo item",
            "description": "Updates a todo item (title or completed status).",
            "tags": ["App - Todo - Items"],
            "parameters": [
                {"name": "group", "in": "path", "required": True, "schema": {"type": "string"}, "description": "Group slug"},
                {"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}, "description": "Todo item ID"},
            ],
            "requestBody": {"required": True, "content": {"application/json": {"schema": schema_obj({
                "title": {"type": "string", "description": "New title"},
                "completed": {"type": "boolean", "description": "Mark as completed (true) or pending (false)"},
            }), "example": {"completed": True}}}},
            "responses": {
                "200": resp(schema_obj({"id": {"type": "integer", "description": "Todo item ID"}, "title": {"type": "string", "description": "Updated title"}, "completed": {"type": "boolean", "description": "Updated completed status"}})),
                "401": error_resp("Unauthorized"),
                "404": error_resp("Not found"),
            },
            "security": bearer_auth,
        },
        "delete": {
            "summary": "Delete a todo item",
            "description": "Deletes a todo item. Owner or admin. Returns 204 on success.",
            "tags": ["App - Todo - Items"],
            "parameters": [
                {"name": "group", "in": "path", "required": True, "schema": {"type": "string"}, "description": "Group slug"},
                {"name": "id", "in": "path", "required": True, "schema": {"type": "integer"}, "description": "Todo item ID"},
            ],
            "responses": {
                "204": {"description": "No Content — deleted successfully"},
                "401": error_resp("Unauthorized"),
                "404": error_resp("Not found"),
            },
            "security": bearer_auth,
        },
    },
}

spec = {
    "openapi": "3.0.2",
    "info": {
        "title": "027Apps API",
        "version": "1.0.0",
        "description": (
            "# 027Apps API\n\n"
            "API pública de la plataforma 027Apps — espacio compartido para aplicaciones, tareas y herramientas entre grupos.\n\n"
            "## Autenticación\n\n"
            "La API soporta dos métodos de autenticación:\n\n"
            "- **JWT Bearer Token** (recomendado): obtenido al iniciar sesión. Enviar como `Authorization: Bearer <token>`.\n"
            "- **API Key**: para acceso de servidor a servidor. Enviar como `X-API-Key: <key>`.\n\n"
            "## Estados de respuesta\n\n"
            "| Código | Significado |\n|--------|-------------|\n"
            "| 200 | Success |\n| 201 | Created |\n| 204 | No Content |\n| 400 | Bad Request |\n| 401 | Unauthorized |\n"
            "| 403 | Forbidden |\n| 404 | Not Found |\n| 422 | Validation Error |\n| 500 | Internal Server Error |\n\n"
            "## Notas\n\n- Todos los endpoints que requieren autenticación devuelven `401` si falta el token.\n"
            "- Los endpoints de administración requieren rol `admin`.\n"
            "- Los endpoints marcados como `Admin - *` requieren autenticación JWT con rol admin.\n"
            "- Los endpoints de la categoría `Shared` están disponibles para cualquier miembro autenticado del grupo.\n"
            "- Los endpoints de `{group}/apps/*` son proxy dinámico que despacha a los route handlers de cada app instalada.\n"
        ),
    },
    "tags": sorted([
        {"name": "Admin - API Keys", "description": "API key management (admin only)"},
        {"name": "Admin - Inspiration", "description": "Inspiration app administration (manage ideas, statuses, lifecycle)"},
        {"name": "Admin - Invitations", "description": "Invitation management (admin only)"},
        {"name": "Admin - Settings", "description": "Group settings (admin only)"},
        {"name": "Admin - Todo", "description": "Todo app administration endpoints"},
        {"name": "Admin - Users", "description": "User management (admin only)"},
        {"name": "App - Inspiration - Ideas", "description": "Idea management within the Inspiration app"},
        {"name": "App - Inspiration - Comments", "description": "Comments on inspiration ideas"},
        {"name": "App - Inspiration - Votes", "description": "Voting on inspiration ideas"},
        {"name": "App - Todo - Items", "description": "Todo item management within the Todo app"},
        {"name": "Apps", "description": "Installed applications and app discovery"},
        {"name": "Health", "description": "Health check and API status"},
        {"name": "Locales", "description": "Locale and language configuration"},
        {"name": "Profile", "description": "Current user profile"},
        {"name": "Shared", "description": "Endpoints available to all authenticated group members"},
    ], key=lambda t: t["name"]),
    "paths": dict(sorted(paths.items())),
    "servers": [
        {"url": "http://localhost:3000", "description": "Local development"},
        {"url": "https://027apps-eric-rf.vercel.app", "description": "Production"},
    ],
    "components": {
        "securitySchemes": {
            "bearerAuth": {
                "type": "http", "scheme": "bearer", "bearerFormat": "JWT",
                "description": "JWT token obtenido al iniciar sesión en la aplicación",
            },
            "apiKey": {
                "type": "apiKey", "in": "header", "name": "X-API-Key",
                "description": "API Key generada desde el panel de administración",
            },
        },
    },
}

import os
output_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'openapi.json')
with open(output_path, 'w') as f:
    json.dump(spec, f, indent=2, ensure_ascii=False)
print(f"Done — openapi.json generated with {len(spec['paths'])} paths and {len(spec['tags'])} tags")
