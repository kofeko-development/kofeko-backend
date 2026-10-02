#!/usr/bin/env bash
# Build the backend image, push it to ECR and roll the ECS service onto it.
#   bash deploy/aws/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

REGION=ap-south-1
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REPO="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/kofeko-backend"
TAG=$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- . || echo "-dirty-$(date +%s)")

aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
docker build --platform linux/arm64 -t "$REPO:$TAG" -t "$REPO:latest" .
docker push "$REPO:$TAG"
docker push "$REPO:latest"

# Point the stack at the new tag (keeps every other parameter as-is)
aws cloudformation update-stack --region $REGION --stack-name kofeko --use-previous-template --capabilities CAPABILITY_IAM \
  --parameters ParameterKey=ImageTag,ParameterValue="$TAG" \
    ParameterKey=ApiDomain,UsePreviousValue=true ParameterKey=AppSecretArn,UsePreviousValue=true \
    ParameterKey=DbPassword,UsePreviousValue=true ParameterKey=FilesBucket,UsePreviousValue=true \
    ParameterKey=DesiredCount,UsePreviousValue=true ParameterKey=InstanceType,UsePreviousValue=true \
    ParameterKey=DbInstanceClass,UsePreviousValue=true ParameterKey=EcsAmi,UsePreviousValue=true \
    ParameterKey=DbDeletionProtection,UsePreviousValue=true
aws cloudformation wait stack-update-complete --region $REGION --stack-name kofeko
echo "Deployed $TAG"
