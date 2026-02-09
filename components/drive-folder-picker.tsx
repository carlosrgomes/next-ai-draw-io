"use client"

import { Check, Folder, Loader2, Plus, Search, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/auth-context"
import { createFolder, listFolders } from "@/lib/google-drive"
import { cn } from "@/lib/utils"

interface DriveFolderPickerProps {
    onSelect: (folderId: string | undefined, folderName?: string) => void
    selectedFolderId?: string
    selectedFolderName?: string
}

export function DriveFolderPicker({
    onSelect,
    selectedFolderId,
    selectedFolderName,
}: DriveFolderPickerProps) {
    const { googleAccessToken } = useAuth()
    const [folders, setFolders] = useState<{ id: string; name: string }[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [newFolderName, setNewFolderName] = useState("")
    const [creatingLoading, setCreatingLoading] = useState(false)
    const [open, setOpen] = useState(false)

    const fetchFolders = async () => {
        if (!googleAccessToken) return
        setLoading(true)
        setError(null)
        try {
            const data = await listFolders(googleAccessToken)
            data.sort((a, b) => a.name.localeCompare(b.name))
            setFolders(data)
        } catch (err) {
            console.error("Failed to fetch folders", err)
            setError("Failed to load folders")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (open) {
            fetchFolders()
        }
    }, [googleAccessToken, open])

    const handleCreateFolder = async () => {
        if (!newFolderName.trim() || !googleAccessToken) return
        setCreatingLoading(true)
        try {
            const newFolder = await createFolder(
                googleAccessToken,
                newFolderName,
            )
            await fetchFolders()
            setNewFolderName("")
            setIsCreating(false)
            onSelect(newFolder.id, newFolder.name)
            setOpen(false)
        } catch (err) {
            console.error("Failed to create folder", err)
            setError("Failed to create folder")
        } finally {
            setCreatingLoading(false)
        }
    }

    const handleSelect = (id: string | undefined, name: string) => {
        onSelect(id, name)
        setOpen(false)
    }

    if (!googleAccessToken) {
        return (
            <div className="text-sm text-muted-foreground p-2 text-center bg-muted/50 rounded-md">
                Sign in to Google to save specific folders.
            </div>
        )
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <div className="flex items-center justify-between p-3 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors group">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Folder className="h-4 w-4 text-blue-500 shrink-0" />
                        <span className="text-sm truncate max-w-[200px] font-medium">
                            {selectedFolderName || "My Drive (Root)"}
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-muted-foreground group-hover:text-foreground"
                    >
                        Change
                    </Button>
                </div>
            </DialogTrigger>
            <DialogContent
                className="sm:max-w-md max-h-[80vh] flex flex-col"
                aria-describedby={undefined}
            >
                <DialogHeader>
                    <div className="flex items-center justify-between pr-8">
                        <DialogTitle>Select Destination</DialogTitle>
                        {!isCreating && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1"
                                onClick={() => setIsCreating(true)}
                            >
                                <Plus className="h-4 w-4" /> New Folder
                            </Button>
                        )}
                    </div>
                </DialogHeader>

                {error && (
                    <div className="text-sm text-destructive p-2 text-center bg-destructive/10 rounded-md">
                        {error}
                    </div>
                )}

                {isCreating && (
                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md animate-in fade-in slide-in-from-top-2">
                        <Input
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="New folder name"
                            className="h-9 text-sm"
                            autoFocus
                            onKeyDown={(e) =>
                                e.key === "Enter" && handleCreateFolder()
                            }
                        />
                        <div className="flex items-center gap-1">
                            <Button
                                size="sm"
                                className="h-9 px-3"
                                onClick={handleCreateFolder}
                                disabled={
                                    creatingLoading || !newFolderName.trim()
                                }
                            >
                                {creatingLoading ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    "Create"
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => setIsCreating(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto min-h-[300px] -mx-6 px-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-[200px]">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/30" />
                        </div>
                    ) : (
                        <div className="space-y-1 py-2">
                            <button
                                className={cn(
                                    "flex items-center w-full px-3 py-3 text-sm rounded-lg transition-all text-left group",
                                    !selectedFolderId
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "hover:bg-muted text-muted-foreground",
                                )}
                                onClick={() =>
                                    handleSelect(undefined, "My Drive (Root)")
                                }
                            >
                                <div
                                    className={cn(
                                        "p-2 rounded-full mr-3",
                                        !selectedFolderId
                                            ? "bg-primary/20"
                                            : "bg-muted group-hover:bg-muted-foreground/20",
                                    )}
                                >
                                    <Folder
                                        className={cn(
                                            "h-5 w-5",
                                            !selectedFolderId
                                                ? "fill-primary text-primary"
                                                : "text-muted-foreground",
                                        )}
                                    />
                                </div>
                                <div className="flex-1">
                                    <span className="block text-sm font-medium text-foreground">
                                        My Drive
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        Root folder
                                    </span>
                                </div>
                                {!selectedFolderId && (
                                    <Check className="ml-2 h-4 w-4 text-primary" />
                                )}
                            </button>

                            {folders.map((folder) => (
                                <button
                                    key={folder.id}
                                    className={cn(
                                        "flex items-center w-full px-3 py-3 text-sm rounded-lg transition-all text-left group",
                                        selectedFolderId === folder.id
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "hover:bg-muted text-foreground",
                                    )}
                                    onClick={() =>
                                        handleSelect(folder.id, folder.name)
                                    }
                                >
                                    <div
                                        className={cn(
                                            "p-2 rounded-full mr-3",
                                            selectedFolderId === folder.id
                                                ? "bg-primary/20"
                                                : "bg-muted group-hover:bg-muted-foreground/20",
                                        )}
                                    >
                                        <Folder
                                            className={cn(
                                                "h-5 w-5",
                                                selectedFolderId === folder.id
                                                    ? "fill-primary text-primary"
                                                    : "text-muted-foreground",
                                            )}
                                        />
                                    </div>
                                    <span className="flex-1 font-medium">
                                        {folder.name}
                                    </span>
                                    {selectedFolderId === folder.id && (
                                        <Check className="ml-2 h-4 w-4 text-primary" />
                                    )}
                                </button>
                            ))}
                            {folders.length === 0 && !loading && (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Folder className="h-12 w-12 text-muted-foreground/20 mb-2" />
                                    <p className="text-sm text-muted-foreground">
                                        No folders found
                                    </p>
                                    <Button
                                        variant="link"
                                        size="sm"
                                        onClick={() => setIsCreating(true)}
                                    >
                                        Create one now
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
