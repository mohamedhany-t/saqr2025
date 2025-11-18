
'use client';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, FirebaseStorage } from "firebase/storage";
import { getApp, FirebaseApp } from "firebase/app";

// This file was refactored to ensure Firebase App is initialized before Storage is accessed.

/**
 * Returns an instance of the Firebase Storage service.
 * This function ensures that `getStorage` is only called after the Firebase app
 * has been initialized on the client side.
 * @param app The initialized FirebaseApp instance.
 * @returns {FirebaseStorage} The Firebase Storage service instance.
 */
function getStorageInstance(app: FirebaseApp): FirebaseStorage {
    return getStorage(app);
}

/**
 * Uploads a file to a specified path in Firebase Storage and reports progress.
 *
 * @param app The initialized FirebaseApp instance.
 * @param path The full path in Firebase Storage where the file should be uploaded.
 * @param file The file object to upload.
 * @param onProgress A callback function that receives the upload progress percentage.
 * @returns A promise that resolves with the public download URL of the uploaded file.
 */
export const uploadFile = (
    app: FirebaseApp,
    path: string,
    file: File,
    onProgress: (progress: number) => void
): Promise<string> => {
    const storage = getStorageInstance(app);
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
 * @param app The initialized FirebaseApp instance.
 * @param path The full path of the file in Firebase Storage.
 * @returns A promise that resolves with the public download URL.
 */
export const getPublicUrl = async (app: FirebaseApp, path: string): Promise<string> => {
    const storage = getStorageInstance(app);
    const storageRef = ref(storage, path);
    try {
        const url = await getDownloadURL(storageRef);
        return url;
    } catch (error) {
        console.error("Error getting public URL:", error);
        throw error;
    }
};
