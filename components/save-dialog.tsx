"use client"

import { useEffect, useState } from "react"
import { DriveFolderPicker } from "@/components/drive-folder-picker"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useDictionary } from "@/hooks/use-dictionary"

export type ExportFormat = "drawio" | "png" | "svg"

interface SaveDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSave: (
        filename: string,
        format: ExportFormat,
        saveToDrive: boolean,
        folderId?: string,
    ) => void
    defaultFilename: string
}

export function SaveDialog({
    open,
    onOpenChange,
    onSave,
    defaultFilename,
}: SaveDialogProps) {
    const dict = useDictionary()
    const [filename, setFilename] = useState(defaultFilename)
    const [format, setFormat] = useState<ExportFormat>("drawio")
    const [saveToDrive, setSaveToDrive] = useState(false)
    const [folderId, setFolderId] = useState<string | undefined>()
    const [folderName, setFolderName] = useState<string | undefined>()

    useEffect(() => {
        if (open) {
            setFilename(defaultFilename)
        }
    }, [open, defaultFilename])

    const handleSave = () => {
        const finalFilename = filename.trim() || defaultFilename
        onSave(finalFilename, format, saveToDrive, folderId)
        onOpenChange(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault()
            handleSave()
        }
    }

    const FORMAT_OPTIONS = [
        {
            value: "drawio" as const,
            label: dict.save.formats.drawio,
            extension: ".drawio",
        },
        {
            value: "png" as const,
            label: dict.save.formats.png,
            extension: ".png",
        },
        {
            value: "svg" as const,
            label: dict.save.formats.svg,
            extension: ".svg",
        },
    ]

    const currentFormat = FORMAT_OPTIONS.find((f) => f.value === format)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{dict.save.title}</DialogTitle>
                    <DialogDescription>
                        {dict.save.description}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                        <label className="text-sm font-medium leading-none">
                            {dict.save.format}
                        </label>
                        <Select
                            value={format}
                            onValueChange={(v) => setFormat(v as ExportFormat)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {FORMAT_OPTIONS.map((opt) => (
                                    <SelectItem
                                        key={opt.value}
                                        value={opt.value}
                                    >
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <label className="text-sm font-medium leading-none">
                            {dict.save.filename}
                        </label>
                        <div className="flex rounded-md shadow-sm">
                            <Input
                                value={filename}
                                onChange={(e) => setFilename(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={dict.save.filenamePlaceholder}
                                autoFocus
                                onFocus={(e) => e.target.select()}
                                className="rounded-r-none focus-visible:z-10"
                            />
                            <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-input bg-muted text-sm text-muted-foreground font-mono min-w-[3.5rem] justify-center">
                                {currentFormat?.extension || ".drawio"}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Switch
                            id="save-to-drive"
                            checked={saveToDrive}
                            onCheckedChange={setSaveToDrive}
                        />
                        <label
                            htmlFor="save-to-drive"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
                        >
                            Save to Google Drive
                        </label>
                    </div>

                    {saveToDrive && (
                        <div className="animate-in fade-in zoom-in-95 duration-200">
                            <DriveFolderPicker
                                onSelect={(id, name) => {
                                    setFolderId(id)
                                    setFolderName(name)
                                }}
                                selectedFolderId={folderId}
                                selectedFolderName={folderName}
                            />
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        {dict.common.cancel}
                    </Button>
                    <Button onClick={handleSave}>{dict.common.save}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
