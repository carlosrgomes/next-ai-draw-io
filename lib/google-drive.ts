/**
 * Uploads a file to Google Drive using the multipart upload API.
 * This allows setting metadata (filename, parent) and content in a single request.
 */
export async function uploadFileToDrive(
    accessToken: string,
    fileContent: Blob,
    filename: string,
    mimeType: string,
    folderId?: string,
): Promise<{ id: string; webViewLink: string }> {
    const metadata: any = {
        name: filename,
        mimeType: mimeType,
    }

    if (folderId) {
        metadata.parents = [folderId]
    }

    const formData = new FormData()
    formData.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" }),
    )
    formData.append("file", fileContent)

    const response = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            body: formData,
        },
    )

    if (!response.ok) {
        const errorData = await response.json()
        throw new Error(
            `Google Drive Upload Failed: ${errorData.error?.message || response.statusText}`,
        )
    }

    return response.json()
}

export async function listFolders(
    accessToken: string,
): Promise<{ id: string; name: string }[]> {
    const query = encodeURIComponent(
        "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    )
    const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=1000`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        },
    )

    if (!response.ok) {
        const errorData = await response.json()
        throw new Error(
            `Failed to list Drive folders: ${errorData.error?.message || response.statusText}`,
        )
    }

    const data = await response.json()
    return data.files || []
}

export async function createFolder(
    accessToken: string,
    folderName: string,
    parentId?: string,
): Promise<{ id: string; name: string }> {
    const metadata: any = {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
    }

    if (parentId) {
        metadata.parents = [parentId]
    }

    const response = await fetch(
        "https://www.googleapis.com/drive/v3/files?fields=id,name",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(metadata),
        },
    )

    if (!response.ok) {
        const errorData = await response.json()
        throw new Error(
            `Failed to create folder: ${errorData.error?.message || response.statusText}`,
        )
    }

    return response.json()
}
