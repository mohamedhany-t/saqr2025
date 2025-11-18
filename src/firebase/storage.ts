
'use client';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, FirebaseStorage } from "firebase/storage";
import { getApp } from "firebase/app";

// A singleton instance of the storage service.
// This is initialized lazily to ensure Firebase app is available.
let storageInstance: FirebaseStorage | null = null;

/**
 * Returns a lazily-initialized instance of the Firebase Storage service.
 * This function ensures that `getStorage` is only called after the Firebase app
 * has been initialized on the client side.
 * @returns {FirebaseStorage} The Firebase Storage service instance.
 */
function getStorageInstance(): FirebaseStorage {
    if (!storageInstance) {
        // Get the already-initialized Firebase app and then get the storage service.
        const app = getApp();
        storageInstance = getStorage(app);
    }
    return storageInstance;
}

/**
 * Uploads a file to a specified path in Firebase Storage and reports progress.
 *
 * @param path The full path in Firebase Storage where the file should be uploaded.
 * @param file The file object to upload.
 * @param onProgress A callback function that receives the upload progress percentage.
 * @returns A promise that resolves with the public download URL of the uploaded file.
 */
export const uploadFile = (
    path: string,
    file: File,
    onProgress: (progress: number) => void
): Promise<string> => {
    // Get the storage service instance lazily.
    const storage = getStorageInstance();
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);

    const promise = new Promise<string>((resolve, reject) => {
        uploadTask.on(
            "state_changed",
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                onProgress(progress);
            },
            (error) => {
                console.error("Upload failed:", error);
                reject(error);
            },
            () => {
                // On successful upload, get the public URL.
                getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                    resolve(downloadURL);
                });
            }
        );
    });

    return promise;
};

/**
 * Retrieves the public download URL for a file stored in Firebase Storage.
 *
 * @param path The full path of the file in Firebase Storage.
 * @returns A promise that resolves with the public download URL.
 */
export const getPublicUrl = async (path: string): Promise<string> => {
    const storage = getStorageInstance();
    const storageRef = ref(storage, path);
    try {
        const url = await getDownloadURL(storageRef);
        return url;
    } catch (error) {
        console.error("Error getting public URL:", error);
        throw error;
    }
};

// Export the lazy-initialized storage instance for direct use if needed,
// though using the functions above is generally safer.
export { getStorageInstance as storage };
