
'use client';

import { getStorage, ref, uploadBytesResumable, getDownloadURL, type UploadTask } from "firebase/storage";
import { useFirebaseApp } from "./provider";

/**
 * Custom hook to get an file uploader function.
 * @returns A function to upload a file and get progress and download URL.
 */
export function useUploader() {
    const app = useFirebaseApp();
    
    /**
     * Uploads a file to a specified path in Firebase Storage.
     * @param filePath The full path in storage where the file should be saved (e.g., 'user-avatars/userId.jpg').
     * @param file The file object to upload.
     * @param onProgress Callback to report upload progress (0-100).
     * @returns A promise that resolves with the public download URL of the uploaded file.
     */
    const uploadFile = (
        filePath: string,
        file: File,
        onProgress: (progress: number) => void
    ): Promise<string> => {
        return new Promise((resolve, reject) => {
            // Get storage instance directly here to ensure it's initialized
            const storage = getStorage(app);
            const storageRef = ref(storage, filePath);
            const uploadTask: UploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    onProgress(progress);
                },
                (error) => {
                    console.error("Upload failed:", error);
                    reject(error);
                },
                async () => {
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        resolve(downloadURL);
                    } catch (error) {
                        console.error("Failed to get download URL:", error);
                        reject(error);
                    }
                }
            );
        });
    };

    return { uploadFile };
}
