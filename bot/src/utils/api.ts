const API_URL = process.env.API_URL || "http://localhost:3000";

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function apiRequest<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const apiSecret = process.env.API_SECRET;
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(apiSecret && { "Authorization": `Bearer ${apiSecret}` }),
        ...options.headers
      }
    });

    const data = await response.json() as T & { error?: string };
    if (!data){
      return { error: "API request failed" };
    }
    
    if (!response.ok) {
      return { error: data.error || "API request failed" };
    }

    return { data };
  } catch (error) {
    console.error("API request error:", error);
    return { error: "Failed to connect to server" };
  }
}

export async function registerUser(params: {
  id: string;
  guildId: string;
  paypalEmail?: string;
  paypalMeUsername?: string;
  currency?: string;
}) {
  return apiRequest("/api/users", {
    method: "POST",
    body: JSON.stringify(params)
  });
}

export async function getUser(userId: string, guildId: string) {
  return apiRequest(`/api/users/${userId}/guild/${guildId}`);
}

export async function updateUser(userId: string, guildId: string, params: {
  paypalEmail?: string;
  paypalMeUsername?: string;
  currency?: string;
}) {
  return apiRequest(`/api/users/${userId}/guild/${guildId}`, {
    method: "PATCH",
    body: JSON.stringify(params)
  });
}

export async function registerGuild(params: {
  id: string;
  name: string;
  webhookUrl?: string;
}) {
  return apiRequest("/api/guilds", {
    method: "POST",
    body: JSON.stringify(params)
  });
}

export async function updateGuildWebhook(guildId: string, webhookUrl: string) {
  return apiRequest(`/api/guilds/${guildId}/webhook`, {
    method: "PATCH",
    body: JSON.stringify({ webhookUrl })
  });
}

export async function createInvoice(params: {
  userId: string;
  guildId: string;
  clientDiscordId: string;
  clientEmail?: string;
  amount: number;
  currency: string;
  description: string;
}) {
  return apiRequest("/api/invoices", {
    method: "POST",
    body: JSON.stringify(params)
  });
}

export async function listInvoices(guildId: string, userId?: string, status?: string) {
  let url = `/api/invoices/guild/${guildId}`;
  const params = new URLSearchParams();
  if (userId) params.append("userId", userId);
  if (status) params.append("status", status);
  if (params.toString()) url += `?${params.toString()}`;
  
  return apiRequest(url);
}

export async function getInvoice(invoiceId: string) {
  return apiRequest(`/api/invoices/${invoiceId}`);
}

export async function cancelInvoice(invoiceId: string) {
  return apiRequest(`/api/invoices/${invoiceId}/cancel`, {
    method: "PATCH"
  });
}

export async function deleteInvoice(invoiceId: string) {
  return apiRequest(`/api/invoices/${invoiceId}`, {
    method: "DELETE"
  });
}

export async function remindInvoice(invoiceId: string) {
  return apiRequest<{
    success: boolean;
    clientDiscordId: string;
    paypalLink: string;
    amount: number;
    currency: string;
    description: string;
  }>(`/api/invoices/${invoiceId}/remind`, {
    method: "POST"
  });
}

export async function deleteInvoices(guildId: string, userId: string, status?: string) {
  let url = "/api/invoices";
  const params = new URLSearchParams();
  params.append("userId", userId);
  params.append("guildId", guildId);
  if (status) params.append("status", status);
  url += `?${params.toString()}`;

  return apiRequest(url, {
    method: "DELETE"
  });
}

export async function createTemplate(params: {
  userId: string;
  guildId: string;
  name: string;
  amount: number;
  currency: string;
  description: string;
}) {
  return apiRequest("/api/templates", {
    method: "POST",
    body: JSON.stringify(params)
  });
}

export async function listTemplates(guildId: string, userId: string) {
  return apiRequest(`/api/templates/guild/${guildId}/user/${userId}`);
}

export async function getTemplateByName(guildId: string, userId: string, name: string) {
  return apiRequest(`/api/templates/guild/${guildId}/user/${userId}/name/${encodeURIComponent(name)}`);
}

export async function deleteTemplate(templateId: string) {
  return apiRequest(`/api/templates/${templateId}`, {
    method: "DELETE"
  });
}

export async function saveClient(params: {
  userId: string;
  guildId: string;
  discordId: string;
  name: string;
  email: string;
}) {
  return apiRequest("/api/clients", {
    method: "POST",
    body: JSON.stringify(params)
  });
}

export async function listClients(guildId: string, userId: string) {
  return apiRequest(`/api/clients/user/${userId}/guild/${guildId}`);
}

export async function getClient(guildId: string, userId: string, clientId: string) {
  return apiRequest(`/api/clients/user/${userId}/guild/${guildId}/client/${clientId}`);
}

export async function deleteClient(guildId: string, userId: string, clientId: string) {
  return apiRequest(`/api/clients/user/${userId}/guild/${guildId}/client/${clientId}`, {
    method: "DELETE"
  });
}
