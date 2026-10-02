# Kofeko on AWS (ECS, low-cost)

Region **ap-south-1 (Mumbai)**. Sized for a handful of users, and it grows without re-architecting.

```
Cloudflare DNS
  kofeko.com      -> AWS Amplify Hosting (Next.js frontend)
  api.kofeko.com  -> Elastic IP -> EC2 t4g.micro (ECS cluster "kofeko")
                                     service kofeko-api: [caddy :443 HTTPS] -> [api :5001]
                                                                    |-> RDS Postgres 17 (private subnets)
                                                                    |-> S3 kofeko-files-388257 (uploads)
                                     env vars <- Secrets Manager "kofeko/prod/backend"
```

| Piece | Service | $/month |
|---|---|---|
| ECS host | EC2 t4g.micro (ARM, 1 GB) + 30 GB gp3 + Elastic IP; Redis runs as a container in the task | ~$10.50 |
| Database | RDS db.t4g.micro Postgres 17, 20 GB gp3 (auto-grows to 100), 7-day backups | ~$18 |
| Secrets, logs, S3, ECR | | ~$1.50 |
| Frontend | Amplify Hosting | ~$1–2 |
| **Total** | | **~$31** |

There is no load balancer, NAT gateway or ElastiCache yet. Those are the expensive fixed costs, and they get added when traffic needs them (see "Scaling" below).

Everything except the ECR repo `kofeko-backend` and the secret is defined in [`aws/kofeko-stack.yml`](aws/kofeko-stack.yml) (CloudFormation stack `kofeko`).

## Day-to-day

| Task | How |
|---|---|
| Deploy backend code | `bash deploy/aws/deploy.sh` (builds the ARM image, pushes to ECR, updates the stack). Prisma migrations run on container start. ~30 s of downtime. |
| Change an env var | Edit secret `kofeko/prod/backend` in Secrets Manager, then `aws ecs update-service --cluster kofeko --service kofeko-api --force-new-deployment` |
| Logs | CloudWatch log group `/kofeko/backend` (or `aws logs tail /kofeko/backend --follow`) |
| Shell on the host | Systems Manager → Session Manager → `kofeko-ecs-host` (no SSH port open) |
| Restore DB | RDS console → `kofeko-db` → Restore to point in time |

## Frontend (Amplify)

1. AWS Console → **Amplify → Create new app → GitHub** → `kofeko-development/kofeko-app`, branch `main`. `amplify.yml` is in the repo.
2. Environment variables:
   ```
   NEXT_PUBLIC_API_BASE_URL=https://api.kofeko.com/api/v1
   NEXT_PUBLIC_APP_FRONTEND_URL=https://kofeko.com
   NEXT_PUBLIC_DEFAULT_TENANT_SLUG=<same as Vercel>
   NEXT_PUBLIC_SUPABASE_URL=<same as Vercel>
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<same as Vercel>
   ```
3. Test on the `*.amplifyapp.com` URL. Then go to **Custom domains**, add `kofeko.com` + `www`, and create the records Amplify shows in Cloudflare with **DNS only** (grey cloud).

## Cutover checklist

- [x] Production env vars (from Render) in the secret; fresh RDS database, migrated and seeded on first start
- [ ] Cloudflare: `A api.kofeko.com → ApiPublicIp`, **DNS only**
- [x] Service DesiredCount = 1 (backend running)
- [ ] `https://api.kofeko.com/health` OK (after the DNS record)
- [ ] Amplify frontend live on kofeko.com
- [ ] LinkedIn app redirect URL → `https://api.kofeko.com/api/v1/linkedin/callback`
- [ ] AWS Billing budget alert (e.g. $40/month)
- [ ] After a week: shut down Render, Vercel, Supabase DB/storage (keep Supabase Auth, which candidate login still uses)

### Copying a database in (one-off ops task, optional)

Temporarily add `SOURCE_DATABASE_URL` (Supabase **session pooler**, port 5432, password URL-encoded) to the secret, then:

```bash
aws ecs run-task --cluster kofeko --task-definition kofeko-ops --overrides '{"containerOverrides":[{"name":"ops","command":["sh","-c","apk add -q jq && SRC=$(echo \"$APP_SECRETS_JSON\" | jq -r .SOURCE_DATABASE_URL) && pg_dump \"$SRC\" -Fc --no-owner --no-privileges -n public | pg_restore --no-owner --no-privileges -d \"$DATABASE_URL\" && echo COPY_OK"]}]}'
aws logs tail /kofeko/backend --log-stream-name-prefix ops --follow
```

Remove `SOURCE_DATABASE_URL` from the secret afterwards.

## Scaling (in order, only when needed)

1. **More RAM/CPU:** change the `InstanceType` parameter (t4g.small $8, t4g.medium $16) and update the stack. Same for `DbInstanceClass`.
2. **2+ API tasks / zero-downtime deploys:** add an Application Load Balancer (~$20 + IPv4), switch the service to Fargate or an Auto Scaling group, and replace Caddy with an ACM certificate on the ALB. Before running 2+ tasks, move the SSE `eventBus` to Redis pub/sub and add ElastiCache Valkey (~$12): the in-memory cache and events are per-task today.
3. **High availability DB:** RDS Multi-AZ (doubles the DB cost).
