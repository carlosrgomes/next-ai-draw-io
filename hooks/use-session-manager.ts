"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { auth } from "@/lib/firebase"
import {
    deleteSessionFromFirestore,
    getSessionFromFirestore,
    getSessionsMetadataFromFirestore,
    saveSessionToFirestore,
} from "@/lib/firestore-service"
import {
    type ChatSession,
    createEmptySession,
    deleteSession as deleteSessionFromDB,
    enforceSessionLimit,
    extractTitle,
    getAllSessionMetadata,
    getSession,
    isIndexedDBAvailable,
    migrateFromLocalStorage,
    type SessionMetadata,
    type StoredMessage,
    saveSession,
} from "@/lib/session-storage"

export interface SessionData {
    messages: StoredMessage[]
    xmlSnapshots: [number, string][]
    diagramXml: string
    thumbnailDataUrl?: string
    diagramHistory?: { svg: string; xml: string }[]
}

export interface UseSessionManagerReturn {
    // State
    sessions: SessionMetadata[]
    currentSessionId: string | null
    currentSession: ChatSession | null
    isLoading: boolean
    isAvailable: boolean

    // Actions
    switchSession: (id: string) => Promise<SessionData | null>
    deleteSession: (id: string) => Promise<{ wasCurrentSession: boolean }>
    // forSessionId: optional session ID to verify save targets correct session (prevents stale debounce writes)
    saveCurrentSession: (
        data: SessionData,
        forSessionId?: string | null,
    ) => Promise<void>
    refreshSessions: () => Promise<void>
    clearCurrentSession: () => void
}

interface UseSessionManagerOptions {
    /** Session ID from URL param - if provided, load this session; if null, start blank */
    initialSessionId?: string | null
}

export function useSessionManager(
    options: UseSessionManagerOptions = {},
): UseSessionManagerReturn {
    const { initialSessionId } = options
    const [sessions, setSessions] = useState<SessionMetadata[]>([])
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(
        null,
    )
    const [currentSession, setCurrentSession] = useState<ChatSession | null>(
        null,
    )
    const [isLoading, setIsLoading] = useState(true)
    const [isAvailable, setIsAvailable] = useState(false)

    const { user } = useAuth()
    const isInitializedRef = useRef(false)
    // Sequence guard for URL changes - prevents out-of-order async resolution
    const urlChangeSequenceRef = useRef(0)

    // Load sessions list
    const refreshSessions = useCallback(async () => {
        try {
            if (user && auth.currentUser) {
                const metadata = await getSessionsMetadataFromFirestore(
                    user.uid,
                )
                setSessions(metadata)
            } else if (isIndexedDBAvailable()) {
                const metadata = await getAllSessionMetadata()
                setSessions(metadata)
            }
        } catch (error: any) {
            if (error?.code === "permission-denied") return
            console.error("Failed to refresh sessions:", error)
        }
    }, [user])

    // Initialize on mount or user change
    useEffect(() => {
        // Reset init ref when user changes to re-fetch sessions
        isInitializedRef.current = false
    }, [user])

    useEffect(() => {
        if (isInitializedRef.current) return
        isInitializedRef.current = true

        async function init() {
            setIsLoading(true)

            if (!user && !isIndexedDBAvailable()) {
                setIsAvailable(false)
                setIsLoading(false)
                return
            }

            setIsAvailable(true)

            try {
                // Run migration first (one-time conversion from localStorage) - only for IndexedDB for now
                if (!user) {
                    await migrateFromLocalStorage()
                }

                // Load sessions list
                if (user && auth.currentUser) {
                    try {
                        const metadata = await getSessionsMetadataFromFirestore(
                            user.uid,
                        )
                        setSessions(metadata)
                    } catch (e: any) {
                        if (e?.code !== "permission-denied") throw e
                    }
                } else {
                    const metadata = await getAllSessionMetadata()
                    setSessions(metadata)
                }

                // Only load a session if initialSessionId is provided (from URL param)
                if (initialSessionId) {
                    let session: ChatSession | null = null
                    if (user && auth.currentUser) {
                        // Cast the result to ChatSession | null to match the type
                        try {
                            const fsSession = await getSessionFromFirestore(
                                user.uid,
                                initialSessionId,
                            )
                            // Ensure compatibility or cast if types match
                            session = fsSession as ChatSession | null
                        } catch (e: any) {
                            if (e?.code !== "permission-denied") throw e
                        }
                    } else {
                        session = await getSession(initialSessionId)
                    }

                    if (session) {
                        setCurrentSession(session)
                        setCurrentSessionId(session.id)
                    }
                    // If session not found, stay in blank state (URL has invalid session ID)
                }
                // If no initialSessionId, start with blank state (no auto-restore)
            } catch (error) {
                console.error("Failed to initialize session manager:", error)
            } finally {
                setIsLoading(false)
            }
        }

        init()
    }, [initialSessionId, user])

    // Handle URL session ID changes after initialization
    // Note: intentionally NOT including currentSessionId in deps to avoid race conditions
    // when clearCurrentSession() is called before URL updates
    useEffect(() => {
        if (!isInitializedRef.current) return // Wait for initial load
        if (!isAvailable) return

        // Increment sequence to invalidate any pending async operations
        urlChangeSequenceRef.current++
        const currentSequence = urlChangeSequenceRef.current

        async function handleSessionIdChange() {
            if (initialSessionId) {
                // URL has session ID - load it
                let session: ChatSession | null = null

                if (user && auth.currentUser) {
                    try {
                        session = (await getSessionFromFirestore(
                            user.uid,
                            initialSessionId,
                        )) as ChatSession | null
                    } catch (e: any) {
                        if (e?.code !== "permission-denied") throw e
                    }
                } else {
                    session = await getSession(initialSessionId)
                }

                // Check if this request is still the latest (sequence guard)
                // If not, a newer URL change happened while we were loading
                if (currentSequence !== urlChangeSequenceRef.current) {
                    return
                }

                if (session) {
                    // Only update if the session is different from current
                    setCurrentSessionId((current) => {
                        if (current !== session.id) {
                            setCurrentSession(session)
                            return session.id
                        }
                        return current
                    })
                }
            }
            // Removed: else clause that clears session
            // Clearing is now handled explicitly by clearCurrentSession()
            // This prevents race conditions when URL update is async
        }

        handleSessionIdChange()
    }, [initialSessionId, isAvailable, user])

    // Refresh sessions on window focus (multi-tab sync)
    useEffect(() => {
        const handleFocus = () => {
            refreshSessions()
        }
        window.addEventListener("focus", handleFocus)
        return () => window.removeEventListener("focus", handleFocus)
    }, [refreshSessions])

    // Switch to a different session
    const switchSession = useCallback(
        async (id: string): Promise<SessionData | null> => {
            if (id === currentSessionId) return null

            // Save current session first if it has messages
            if (currentSession && currentSession.messages.length > 0) {
                if (user && auth.currentUser) {
                    try {
                        await saveSessionToFirestore(user.uid, currentSession)
                    } catch (e: any) {
                        // Ignore permission errors during switch if auth is unstable
                        if (e?.code !== "permission-denied") throw e
                    }
                } else {
                    await saveSession(currentSession)
                }
            }

            // Load the target session
            let session: ChatSession | null = null
            if (user && auth.currentUser) {
                try {
                    session = (await getSessionFromFirestore(
                        user.uid,
                        id,
                    )) as ChatSession | null
                } catch (e: any) {
                    if (e?.code !== "permission-denied") throw e
                }
            } else {
                session = await getSession(id)
            }

            if (!session) {
                console.error("Session not found:", id)
                return null
            }

            // Update state
            setCurrentSession(session)
            setCurrentSessionId(session.id)

            return {
                messages: session.messages,
                xmlSnapshots: session.xmlSnapshots,
                diagramXml: session.diagramXml,
                thumbnailDataUrl: session.thumbnailDataUrl,
                diagramHistory: session.diagramHistory,
            }
        },
        [currentSessionId, currentSession, user],
    )

    // Delete a session
    const deleteSession = useCallback(
        async (id: string): Promise<{ wasCurrentSession: boolean }> => {
            const wasCurrentSession = id === currentSessionId

            if (user && auth.currentUser) {
                try {
                    await deleteSessionFromFirestore(user.uid, id)
                } catch (e: any) {
                    if (e?.code !== "permission-denied") throw e
                }
            } else {
                await deleteSessionFromDB(id)
            }

            // If deleting current session, clear state (caller will show new empty session)
            if (wasCurrentSession) {
                setCurrentSession(null)
                setCurrentSessionId(null)
            }

            await refreshSessions()

            return { wasCurrentSession }
        },
        [currentSessionId, refreshSessions, user],
    )

    // Save current session data (debounced externally by caller)
    // forSessionId: if provided, verify save targets correct session (prevents stale debounce writes)
    const saveCurrentSession = useCallback(
        async (
            data: SessionData,
            forSessionId?: string | null,
        ): Promise<void> => {
            // If forSessionId is provided, verify it matches current session
            // This prevents stale debounced saves from overwriting a newly switched session
            if (
                forSessionId !== undefined &&
                forSessionId !== currentSessionId
            ) {
                return
            }

            if (!currentSession) {
                // Create a new session if none exists
                const newSession: ChatSession = {
                    ...createEmptySession(),
                    messages: data.messages,
                    xmlSnapshots: data.xmlSnapshots,
                    diagramXml: data.diagramXml,
                    thumbnailDataUrl: data.thumbnailDataUrl,
                    diagramHistory: data.diagramHistory,
                    title: extractTitle(data.messages),
                }

                if (user && auth.currentUser) {
                    try {
                        await saveSessionToFirestore(user.uid, newSession)
                    } catch (e: any) {
                        if (e?.code !== "permission-denied") throw e
                    }
                    // Enforce limit for FS? Maybe later.
                } else {
                    await saveSession(newSession)
                    await enforceSessionLimit()
                }

                setCurrentSession(newSession)
                setCurrentSessionId(newSession.id)
                await refreshSessions()
                return
            }

            // Update existing session
            const updatedSession: ChatSession = {
                ...currentSession,
                messages: data.messages,
                xmlSnapshots: data.xmlSnapshots,
                diagramXml: data.diagramXml,
                thumbnailDataUrl:
                    data.thumbnailDataUrl ?? currentSession.thumbnailDataUrl,
                diagramHistory:
                    data.diagramHistory ?? currentSession.diagramHistory,
                updatedAt: Date.now(),
                // Update title if it's still default and we have messages
                title:
                    currentSession.title === "New Chat" &&
                    data.messages.length > 0
                        ? extractTitle(data.messages)
                        : currentSession.title,
            }

            if (user && auth.currentUser) {
                try {
                    await saveSessionToFirestore(user.uid, updatedSession)
                } catch (e: any) {
                    if (e?.code !== "permission-denied") throw e
                }
            } else {
                await saveSession(updatedSession)
            }

            setCurrentSession(updatedSession)

            // Update sessions list metadata
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === updatedSession.id
                        ? {
                              ...s,
                              title: updatedSession.title,
                              updatedAt: updatedSession.updatedAt,
                              messageCount: updatedSession.messages.length,
                              hasDiagram:
                                  !!updatedSession.diagramXml &&
                                  updatedSession.diagramXml.trim().length > 0,
                              thumbnailDataUrl: updatedSession.thumbnailDataUrl,
                          }
                        : s,
                ),
            )
        },
        [currentSession, currentSessionId, refreshSessions, user],
    )

    // Clear current session state (for starting fresh without loading another session)
    const clearCurrentSession = useCallback(() => {
        setCurrentSession(null)
        setCurrentSessionId(null)
    }, [])

    return {
        sessions,
        currentSessionId,
        currentSession,
        isLoading,
        isAvailable,
        switchSession,
        deleteSession,
        saveCurrentSession,
        refreshSessions,
        clearCurrentSession,
    }
}
