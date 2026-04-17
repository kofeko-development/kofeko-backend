export type CreateMetricInput = {
  tenantId: string;
  name: string;
  value: number;
  dimension?: string;
};
