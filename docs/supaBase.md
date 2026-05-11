nijrab-jewnE7-bepkyc


login to get a token 
curl -s -X POST "http://localhost:5000/api/v1/superadmin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@local.test","password":"temp-dev-only"}'


chnage email and password together 
export TOKEN="paste_access_token_here"

curl -X PATCH "http://localhost:5000/api/v1/superadmin/auth/me" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "currentPassword": "temp-dev-only",
    "email": "newadmin@yourcompany.com",
    "newPassword": "YourNewStrongPassword1"
  }'