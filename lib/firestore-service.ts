import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    setDoc,
    Timestamp,
} from "firebase/firestore"
import { firestore } from "./firebase"
import type { ChatSession, SessionMetadata } from "./session-storage"

// Helper to replace undefined with null for Firestore
function sanitizeForFirestore(obj: any): any {
    if (obj === undefined) {
        return null
    }
    if (obj === null || typeof obj !== "object") {
        return obj
    }
    if (Array.isArray(obj)) {
        return obj.map(sanitizeForFirestore)
    }
    const sanitized: any = {}
    for (const key in obj) {
        if (Object.hasOwn(obj, key)) {
            sanitized[key] = sanitizeForFirestore(obj[key])
        }
    }
    return sanitized
}

export async function saveSessionToFirestore(
    userId: string,
    session: ChatSession,
): Promise<void> {
    try {
        const sessionRef = doc(
            firestore,
            "drawio",
            userId,
            "sessions",
            session.id,
        )
        const { id, xmlSnapshots, ...rest } = session

        // Firestore doesn't support nested arrays (tuples), so we convert to objects
        const serializedSnapshots = xmlSnapshots.map(([ts, xml]) => ({
            ts,
            xml,
        }))

        // Sanitize optional fields to avoid "undefined" error in Firestore
        const sessionData = {
            ...rest,
            userId: userId,
            thumbnailDataUrl: rest.thumbnailDataUrl ?? null,
            diagramHistory: rest.diagramHistory ?? null,
            xmlSnapshots: serializedSnapshots,
            updatedAt: Date.now(), // Ensure we use server-ish time or consistent client time
        }

        await setDoc(sessionRef, sanitizeForFirestore(sessionData))
        console.log(
            `[Firestore] Session saved: drawio/${userId}/sessions/${session.id}`,
        )
    } catch (error) {
        console.error("Error saving session to Firestore:", error)
        throw error
    }
}

export async function getSessionFromFirestore(
    userId: string,
    sessionId: string,
): Promise<ChatSession | null> {
    try {
        const sessionRef = doc(
            firestore,
            "drawio",
            userId,
            "sessions",
            sessionId,
        )
        const docSnap = await getDoc(sessionRef)

        if (docSnap.exists()) {
            const data = docSnap.data()
            // Convert back from objects to tuples
            const xmlSnapshots = (data.xmlSnapshots || []).map((item: any) => [
                item.ts,
                item.xml,
            ])

            return {
                id: docSnap.id,
                ...data,
                xmlSnapshots,
            } as ChatSession
        } else {
            return null
        }
    } catch (error) {
        console.error("Error getting session from Firestore:", error)
        return null
    }
}

export async function getSessionsMetadataFromFirestore(
    userId: string,
): Promise<SessionMetadata[]> {
    try {
        const sessionsRef = collection(firestore, "drawio", userId, "sessions")
        const q = query(sessionsRef, orderBy("updatedAt", "desc"))
        const querySnapshot = await getDocs(q)

        const sessions: SessionMetadata[] = []
        querySnapshot.forEach((doc) => {
            const data = doc.data() as ChatSession // Cast to access fields
            sessions.push({
                id: doc.id,
                title: data.title,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
                messageCount: data.messages?.length || 0,
                hasDiagram:
                    !!data.diagramXml && data.diagramXml.trim().length > 0,
                thumbnailDataUrl: data.thumbnailDataUrl,
            })
        })
        return sessions
    } catch (error) {
        console.error("Error getting sessions metadata from Firestore:", error)
        return []
    }
}

export async function deleteSessionFromFirestore(
    userId: string,
    sessionId: string,
): Promise<void> {
    try {
        const sessionRef = doc(
            firestore,
            "drawio",
            userId,
            "sessions",
            sessionId,
        )
        await deleteDoc(sessionRef)
    } catch (error) {
        console.error("Error deleting session from Firestore:", error)
        throw error
    }
}

// AI Configuration
export async function saveGlobalAIConfig(config: any): Promise<void> {
    try {
        const configRef = doc(firestore, "ai_configurations", "global")
        await setDoc(
            configRef,
            sanitizeForFirestore({
                ...config,
                updatedAt: Date.now(),
            }),
        )
        console.log("[Firestore] Global AI Config saved")
    } catch (error) {
        console.error("Error saving global AI config:", error)
        throw error
    }
}

export async function getGlobalAIConfig(): Promise<any | null> {
    try {
        const configRef = doc(firestore, "ai_configurations", "global")
        const docSnap = await getDoc(configRef)
        if (docSnap.exists()) {
            return docSnap.data()
        }
        return null
    } catch (error) {
        console.error("Error getting global AI config:", error)
        return null
    }
}
