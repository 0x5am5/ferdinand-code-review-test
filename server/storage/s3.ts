import { storageConfig } from "./config";

export interface StorageResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface DownloadResult {
  success: boolean;
  data?: Buffer;
  mimeType?: string;
  error?: string;
}

export interface SignedUrlResult {
  success: boolean;
  url?: string;
  error?: string;
}

// Lazy-load AWS SDK to avoid errors when not configured
let S3Client: any;
let PutObjectCommand: any;
let GetObjectCommand: any;
let DeleteObjectCommand: any;
let HeadObjectCommand: any;
let getSignedUrl: any;

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
    } catch (_error) {
      console.error(
        "Failed to load AWS SDK. Install @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner"
      );
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
  const clientConfig: any = {
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

  return new S3Client(clientConfig);
}

/**
 * Upload a file to S3/R2 storage
 */
export async function uploadFile(
  storagePath: string,
  fileBuffer: Buffer
): Promise<StorageResult> {
  try {
    const client = await initializeS3Client();

    const command = new PutObjectCommand({
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
  } catch (error) {
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
export async function downloadFile(
  storagePath: string
): Promise<DownloadResult> {
  try {
    const client = await initializeS3Client();

    const command = new GetObjectCommand({
      Bucket: storageConfig.bucket,
      Key: storagePath,
    });

    const response = await client.send(command);

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    const data = Buffer.concat(chunks);

    return {
      success: true,
      data,
      mimeType: response.ContentType,
    };
  } catch (error) {
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
export async function deleteFile(storagePath: string): Promise<StorageResult> {
  try {
    const client = await initializeS3Client();

    const command = new DeleteObjectCommand({
      Bucket: storageConfig.bucket,
      Key: storagePath,
    });

    await client.send(command);

    return {
      success: true,
      path: storagePath,
    };
  } catch (error) {
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
export async function fileExists(storagePath: string): Promise<boolean> {
  try {
    const client = await initializeS3Client();

    const command = new HeadObjectCommand({
      Bucket: storageConfig.bucket,
      Key: storagePath,
    });

    await client.send(command);
    return true;
  } catch (error: any) {
    // HeadObject throws an error if the object doesn't exist
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    console.error("Error checking file existence in S3/R2:", error);
    return false;
  }
}

/**
 * Generate a signed URL for temporary access to an S3/R2 file
 */
export async function generateSignedUrl(
  storagePath: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<SignedUrlResult> {
  try {
    const client = await initializeS3Client();

    const command = new GetObjectCommand({
      Bucket: storageConfig.bucket,
      Key: storagePath,
    });

    const signedUrl = await getSignedUrl(client, command, {
      expiresIn,
    });

    // If R2 has a public URL configured, replace the endpoint
    let finalUrl = signedUrl;
    if (
      storageConfig.type === "r2" &&
      storageConfig.publicUrl &&
      storageConfig.endpoint
    ) {
      finalUrl = signedUrl.replace(
        storageConfig.endpoint,
        storageConfig.publicUrl
      );
    }

    return {
      success: true,
      url: finalUrl,
    };
  } catch (error) {
    console.error("Error generating signed URL for S3/R2:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
