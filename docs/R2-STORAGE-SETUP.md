# Cloudflare R2 Storage Setup

This guide explains how to configure Ferdinand to use Cloudflare R2 for file storage instead of local filesystem.

## Why R2?

- **S3-Compatible**: Works with existing AWS SDK code
- **No Egress Fees**: Free data transfer out
- **Cost-Effective**: Lower storage costs than S3
- **Global Performance**: Cloudflare's edge network
- **Easy Migration**: Drop-in replacement for S3

## Prerequisites

1. Cloudflare account
2. R2 subscription enabled (available on paid plans)
3. R2 API tokens created

## Step 1: Create R2 Bucket

1. Log into Cloudflare Dashboard
2. Navigate to **R2** in the sidebar
3. Click **Create bucket**
4. Choose a bucket name (e.g., `ferdinand-assets`)
5. Select location (automatic is recommended)
6. Click **Create bucket**

## Step 2: Generate API Tokens

1. In R2 dashboard, click **Manage R2 API Tokens**
2. Click **Create API token**
3. Set permissions:
   - **Token name**: `ferdinand-production`
   - **Permissions**: Object Read & Write
   - **Specify bucket**: Select your bucket (or allow all)
   - **TTL**: Choose appropriate expiration
4. Click **Create API token**
5. **IMPORTANT**: Copy the credentials shown:
   - Access Key ID
   - Secret Access Key
   - Jurisdiction-specific endpoint for S3 clients

## Step 3: Configure Environment Variables

Add these to your `.env` file or production environment:

```bash
# Storage Configuration
STORAGE_TYPE=r2

# R2 Credentials
R2_BUCKET=ferdinand-assets
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key

# R2 Endpoint (from Cloudflare dashboard)
# Format: https://<account_id>.r2.cloudflarestorage.com
R2_ENDPOINT=https://abc123.r2.cloudflarestorage.com

# Optional: Custom domain for public assets
# R2_PUBLIC_URL=https://assets.yourdomain.com
```

### Finding Your R2 Endpoint

Your R2 endpoint is shown when you create the API token. It follows this format:

```
https://<account_id>.r2.cloudflarestorage.com
```

You can also find it in the R2 dashboard under **Settings** → **Endpoint**.

## Step 4: Optional - Custom Domain Setup

If you want to serve assets from your own domain (e.g., `assets.yourdomain.com`):

### 4.1 Enable Public Access

1. In your R2 bucket settings
2. Go to **Settings** → **Public Access**
3. Click **Allow Access**
4. Note the provided public bucket URL

### 4.2 Configure Custom Domain

1. In R2 bucket, go to **Settings** → **Custom Domains**
2. Click **Connect Domain**
3. Enter your subdomain (e.g., `assets.yourdomain.com`)
4. Follow DNS configuration instructions
5. Wait for DNS propagation

### 4.3 Update Environment Variable

```bash
R2_PUBLIC_URL=https://assets.yourdomain.com
```

This replaces R2's default URL in signed URLs with your custom domain.

## Step 5: Test Configuration

Run this test to verify your R2 setup:

```bash
# Start the server
npm run dev

# Upload a test file through the UI
# The file should be uploaded to R2 instead of local storage
```

Check your R2 bucket in the Cloudflare dashboard to verify the file was uploaded.

## Migration from Local Storage

If you have existing files in local storage that need to be migrated:

### Option 1: Manual Upload via UI

1. Download files from `uploads/` directory
2. Re-upload through Ferdinand UI
3. Files will now be stored in R2

### Option 2: Bulk Migration Script

Create a migration script to bulk upload existing files:

```bash
# TODO: Add migration script
# This would iterate through local uploads/ directory
# and upload each file to R2 while preserving paths
```

## Troubleshooting

### Error: "AWS SDK not installed"

**Solution**: Install required packages:
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### Error: "Storage bucket not configured"

**Solution**: Verify `R2_BUCKET` is set in `.env`

### Error: "Storage credentials not configured"

**Solution**: Verify both `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` are set

### Files not appearing in bucket

**Solution**:
1. Check R2 endpoint is correct
2. Verify account ID matches
3. Check API token has write permissions
4. Look for errors in server logs

### Signed URLs not working

**Solution**:
1. Ensure bucket has public access enabled (if using signed URLs)
2. Verify `R2_PUBLIC_URL` is set correctly if using custom domain
3. Check token has read permissions

## Cost Estimation

R2 pricing (as of 2024):

- **Storage**: $0.015/GB per month
- **Class A operations** (writes): $4.50 per million
- **Class B operations** (reads): $0.36 per million
- **Egress**: FREE (no bandwidth charges)

Example for 100GB storage with moderate usage:
- Storage: ~$1.50/month
- Operations: ~$0.50/month
- **Total: ~$2/month** (vs ~$10/month for comparable S3 usage)

## Switching Between Storage Types

You can switch between local, S3, and R2 storage by changing the `STORAGE_TYPE` environment variable:

```bash
# Local filesystem
STORAGE_TYPE=local

# AWS S3
STORAGE_TYPE=s3

# Cloudflare R2
STORAGE_TYPE=r2
```

**Note**: Existing files won't automatically migrate. You'll need to run a migration script or re-upload.

## Security Best Practices

1. **Rotate API tokens** regularly
2. **Use bucket-specific tokens** (not account-wide)
3. **Set appropriate CORS rules** if serving assets directly
4. **Enable public access** only if needed
5. **Use signed URLs** for private assets
6. **Monitor usage** in Cloudflare dashboard

## Additional Resources

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [R2 API Documentation](https://developers.cloudflare.com/r2/api/s3/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
