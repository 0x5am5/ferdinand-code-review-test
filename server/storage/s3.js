import { storageConfig } from "./config";
// Lazy-load AWS SDK to avoid errors when not configured
// These are initialized as constructors from the AWS SDK modules
let S3Client;
let PutObjectCommand;
let GetObjectCommand;
let DeleteObjectCommand;
let HeadObjectCommand;
let getSignedUrl;
/**
 * Initialize AWS SDK clients (lazy loading)
 */
async function initializeS3Client() {
    if (!S3Client) {
        try {
            const awsS3 = await import("@aws-sdk/client-s3");
            const awsPresigner = await import("@aws-sdk/s3-request-presigner");
            S3Client = awsS3.S3Client;
            PutObjectCommand = awsS3.PutObjectCommand;
            GetObjectCommand = awsS3.GetObjectCommand;
            DeleteObjectCommand = awsS3.DeleteObjectCommand;
            HeadObjectCommand = awsS3.HeadObjectCommand;
            getSignedUrl = awsPresigner.getSignedUrl;
        }
        catch (_error) {
            console.error("Failed to load AWS SDK. Install @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner");
            throw new Error("AWS SDK not installed");
        }
    }
    // Validate configuration
    if (!storageConfig.bucket) {
        throw new Error("Storage bucket not configured");
    }
    if (!storageConfig.accessKeyId || !storageConfig.secretAccessKey) {
        throw new Error("Storage credentials not configured");
    }
    // Create S3/R2 client
    const clientConfig = {
        region: storageConfig.region || "auto",
        credentials: {
            accessKeyId: storageConfig.accessKeyId,
            secretAccessKey: storageConfig.secretAccessKey,
        },
    };
    // For R2, we need to use the custom endpoint
    if (storageConfig.type === "r2" && storageConfig.endpoint) {
        clientConfig.endpoint = storageConfig.endpoint;
    }
    // Create client using dynamic constructor
    const ClientConstructor = S3Client;
    return new ClientConstructor(clientConfig);
}
/**
 * Upload a file to S3/R2 storage
 */
export async function uploadFile(storagePath, fileBuffer) {
    try {
        const client = await initializeS3Client();
        const CommandConstructor = PutObjectCommand;
        const command = new CommandConstructor({
            Bucket: storageConfig.bucket,
            Key: storagePath,
            Body: fileBuffer,
            // Set appropriate content type if needed
            // ContentType can be inferred from the file extension
        });
        await client.send(command);
        return {
            success: true,
            path: storagePath,
        };
    }
    catch (error) {
        console.error("Error uploading file to S3/R2:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
/**
 * Download a file from S3/R2 storage
 */
export async function downloadFile(storagePath) {
    try {
        const client = await initializeS3Client();
        const CommandConstructor = GetObjectCommand;
        const command = new CommandConstructor({
            Bucket: storageConfig.bucket,
            Key: storagePath,
        });
        const response = (await client.send(command));
        // Convert stream to buffer
        const chunks = [];
        const body = response.Body;
        for await (const chunk of body) {
            chunks.push(chunk);
        }
        const data = Buffer.concat(chunks);
        return {
            success: true,
            data,
            mimeType: typeof response.ContentType === "string"
                ? response.ContentType
                : undefined,
        };
    }
    catch (error) {
        console.error("Error downloading file from S3/R2:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
/**
 * Delete a file from S3/R2 storage
 */
export async function deleteFile(storagePath) {
    try {
        const client = await initializeS3Client();
        const CommandConstructor = DeleteObjectCommand;
        const command = new CommandConstructor({
            Bucket: storageConfig.bucket,
            Key: storagePath,
        });
        await client.send(command);
        return {
            success: true,
            path: storagePath,
        };
    }
    catch (error) {
        console.error("Error deleting file from S3/R2:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
/**
 * Check if a file exists in S3/R2 storage
 */
export async function fileExists(storagePath) {
    try {
        const client = await initializeS3Client();
        const CommandConstructor = HeadObjectCommand;
        const command = new CommandConstructor({
            Bucket: storageConfig.bucket,
            Key: storagePath,
        });
        await client.send(command);
        return true;
    }
    catch (error) {
        // HeadObject throws an error if the object doesn't exist
        const err = error;
        if (err.name === "NotFound" ||
            err.$metadata?.httpStatusCode === 404) {
            return false;
        }
        console.error("Error checking file existence in S3/R2:", error);
        return false;
    }
}
/**
 * Generate a signed URL for temporary access to an S3/R2 file
 */
export async function generateSignedUrl(storagePath, expiresIn = 3600 // 1 hour default
) {
    try {
        const client = await initializeS3Client();
        const CommandConstructor = GetObjectCommand;
        const command = new CommandConstructor({
            Bucket: storageConfig.bucket,
            Key: storagePath,
        });
        const getSignedUrlFn = getSignedUrl;
        const signedUrl = await getSignedUrlFn(client, command, {
            expiresIn,
        });
        // If R2 has a public URL configured, replace the endpoint
        let finalUrl = signedUrl;
        if (storageConfig.type === "r2" &&
            storageConfig.publicUrl &&
            storageConfig.endpoint) {
            finalUrl = signedUrl.replace(storageConfig.endpoint, storageConfig.publicUrl);
        }
        return {
            success: true,
            url: finalUrl,
        };
    }
    catch (error) {
        console.error("Error generating signed URL for S3/R2:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
