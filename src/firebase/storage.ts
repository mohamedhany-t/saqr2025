
'use client';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import type { UploadTask } from "firebase/storage";

const storage = getStorage();

export const uploadFile = (
    path: string,
    file: File,
    onProgress: (progress: number) => void
): { task: UploadTask; promise: Promise<string> } => {
    
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

    return { task: uploadTask, promise };
};

export const getPublicUrl = async (path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    try {
        const url = await getDownloadURL(storageRef);
        return url;
    } catch (error) {
        console.error("Error getting public URL:", error);
        throw error;
    }
};

export { storage };
