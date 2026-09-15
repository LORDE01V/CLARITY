/** Organization types matching backend app.models.org */

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
}

export interface OrganizationCreate {
  name: string;
  slug: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
}
