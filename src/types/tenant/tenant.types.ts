export type CreateTenantInput = {
  name: string;
  slug: string;
  companyId?: string;
};

export type UpdateTenantInput = Partial<CreateTenantInput>;
