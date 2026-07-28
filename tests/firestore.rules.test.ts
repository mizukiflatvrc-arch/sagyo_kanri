import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteField,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { afterAll, afterEach, beforeAll, describe, it } from "vitest";

const PROJECT_ID = "demo-library-work-log-rules";
const RULES_SOURCE = readFileSync(
  resolve(process.cwd(), "firestore.rules"),
  "utf8",
);
const OWNER_UID = "owner-user";
const OTHER_UID = "other-user";

const TEST_DOCUMENT = {
  createdAt: "2026-07-23T00:00:00.000Z",
  value: "rules-test",
};

function validLibraryDocument(userId: string) {
  return {
    userId,
    name: "中央図書館",
    googleMapsUrl: "https://maps.google.com/example",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function validSessionDocument(userId: string) {
  return {
    userId,
    libraryId: "library-1",
    enteredAt: Timestamp.fromDate(new Date("2026-07-23T00:00:00.000Z")),
    exitedAt: Timestamp.fromDate(new Date("2026-07-23T02:00:00.000Z")),
    stayMinutes: 120,
    actualWorkMinutes: 80,
    concentrationScore: 6,
    anxietyScore: 4,
    fatigueScore: 5,
    selfCriticismMinutes: 15,
    plannedTaskCreated: true,
    plannedTaskText: "資料を読む",
    actualTaskText: "資料を読んだ",
    completionStatus: "mostly_on_schedule",
    nextDayReaction: "pending",
    nextDayNote: "",
    note: "",
    version: 1,
    deleting: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function validRevisionDocument(
  sessionId: string,
  version: number,
  snapshot: DocumentData,
  changedFields: string[] = ["note"],
) {
  return {
    sessionId,
    version,
    snapshot,
    changedAt: serverTimestamp(),
    changedFields,
  };
}

let testEnvironment: RulesTestEnvironment;

function protectedDocumentPaths(uid: string) {
  return [
    `users/${uid}/libraries/library-1`,
    `users/${uid}/sessions/session-1`,
    `users/${uid}/sessions/session-1/revisions/1`,
  ] as const;
}

async function seedDocument(path: string) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), TEST_DOCUMENT);
  });
}

async function seedProtectedDocuments(uid: string) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await setDoc(
      doc(firestore, `users/${uid}/libraries/library-1`),
      validLibraryDocument(uid),
    );
    const sessionReference = doc(
      firestore,
      `users/${uid}/sessions/session-1`,
    );
    await setDoc(
      sessionReference,
      validSessionDocument(uid),
    );
    const sessionSnapshot = await getDoc(sessionReference);
    await setDoc(
      doc(
        firestore,
        `users/${uid}/sessions/session-1/revisions/1`,
      ),
      validRevisionDocument(
        "session-1",
        1,
        sessionSnapshot.data() ?? {},
      ),
    );
  });
}

async function assertProtectedWritesFail(
  firestore: ReturnType<RulesTestContext["firestore"]>,
  targetUid: string,
) {
  await assertFails(
    setDoc(
      doc(firestore, `users/${targetUid}/libraries/library-new`),
      validLibraryDocument(targetUid),
    ),
  );
  await assertFails(
    setDoc(
      doc(firestore, `users/${targetUid}/sessions/session-new`),
      validSessionDocument(targetUid),
    ),
  );

  const revisionBatch = writeBatch(firestore);
  revisionBatch.set(
    doc(
      firestore,
      `users/${targetUid}/sessions/session-1/revisions/forbidden`,
    ),
    TEST_DOCUMENT,
  );
  revisionBatch.update(
    doc(firestore, `users/${targetUid}/sessions/session-1`),
    { version: 2, updatedAt: serverTimestamp() },
  );
  await assertFails(revisionBatch.commit());
}

describe("Firestore security rules", () => {
  beforeAll(async () => {
    const emulatorAddress =
      process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
    const separatorIndex = emulatorAddress.lastIndexOf(":");
    const host = emulatorAddress.slice(0, separatorIndex);
    const port = Number(emulatorAddress.slice(separatorIndex + 1));

    testEnvironment = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host,
        port,
        rules: RULES_SOURCE,
      },
    });
  });

  afterEach(async () => {
    await testEnvironment.clearFirestore();
  });

  afterAll(async () => {
    await testEnvironment.cleanup();
  });

  it("未認証ユーザーの読み書きを拒否する", async () => {
    const firestore = testEnvironment.unauthenticatedContext().firestore();
    await seedProtectedDocuments(OWNER_UID);

    for (const path of protectedDocumentPaths(OWNER_UID)) {
      const reference = doc(firestore, path);

      await assertFails(getDoc(reference));
    }
    await assertProtectedWritesFail(firestore, OWNER_UID);
  });

  it("認証済みユーザーでも他人のパスへの読み書きを拒否する", async () => {
    const firestore = testEnvironment
      .authenticatedContext(OWNER_UID)
      .firestore();
    await seedProtectedDocuments(OTHER_UID);

    for (const path of protectedDocumentPaths(OTHER_UID)) {
      const reference = doc(firestore, path);

      await assertFails(getDoc(reference));
    }
    await assertProtectedWritesFail(firestore, OTHER_UID);
  });

  it("認証済みの本人は libraries、sessions、revisions を利用できる", async () => {
    const firestore = testEnvironment
      .authenticatedContext(OWNER_UID)
      .firestore();
    const libraryReference = doc(
      firestore,
      `users/${OWNER_UID}/libraries/library-1`,
    );
    const sessionReference = doc(
      firestore,
      `users/${OWNER_UID}/sessions/session-1`,
    );
    const revisionReference = doc(
      firestore,
      `users/${OWNER_UID}/sessions/session-1/revisions/1`,
    );

    await assertSucceeds(
      setDoc(libraryReference, validLibraryDocument(OWNER_UID)),
    );
    await assertSucceeds(getDoc(libraryReference));

    await assertSucceeds(
      setDoc(sessionReference, validSessionDocument(OWNER_UID)),
    );
    await assertSucceeds(getDoc(sessionReference));
    const sessionBeforeUpdate = await getDoc(sessionReference);
    const revisionBatch = writeBatch(firestore);
    revisionBatch.set(
      revisionReference,
      validRevisionDocument(
        "session-1",
        1,
        sessionBeforeUpdate.data() ?? {},
      ),
    );
    revisionBatch.update(sessionReference, {
      note: "更新後のメモ",
      version: 2,
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(revisionBatch.commit());
    await assertSucceeds(getDoc(revisionReference));

    // Revisions are immutable, and the parent must enter deletion mode before
    // either the snapshots or the parent itself can be removed.
    await assertFails(setDoc(revisionReference, { value: "tampered" }));
    await assertFails(deleteDoc(revisionReference));
    await assertFails(deleteDoc(sessionReference));

    await assertSucceeds(
      setDoc(
        sessionReference,
        { deleting: true, updatedAt: serverTimestamp() },
        { merge: true },
      ),
    );
    await assertFails(
      setDoc(sessionReference, { value: "changed" }, { merge: true }),
    );
    await assertFails(
      setDoc(
        doc(
          firestore,
          `users/${OWNER_UID}/sessions/session-1/revisions/2`,
        ),
        TEST_DOCUMENT,
      ),
    );
    await assertSucceeds(deleteDoc(revisionReference));
    await assertSucceeds(deleteDoc(sessionReference));
    await assertFails(deleteDoc(libraryReference));
    await assertSucceeds(
      setDoc(
        libraryReference,
        {
          archivedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    );
  });

  it("deletingにはboolean以外を保存できない", async () => {
    const firestore = testEnvironment
      .authenticatedContext(OWNER_UID)
      .firestore();
    const reference = doc(
      firestore,
      `users/${OWNER_UID}/sessions/session-1`,
    );
    const libraryReference = doc(
      firestore,
      `users/${OWNER_UID}/libraries/library-1`,
    );

    await assertSucceeds(
      setDoc(libraryReference, validLibraryDocument(OWNER_UID)),
    );
    await assertSucceeds(
      setDoc(reference, validSessionDocument(OWNER_UID)),
    );
    await assertFails(
      setDoc(reference, { deleting: "broken" }, { merge: true }),
    );
  });

  it("親セッションがない更新履歴の作成を拒否する", async () => {
    const firestore = testEnvironment
      .authenticatedContext(OWNER_UID)
      .firestore();
    const reference = doc(
      firestore,
      `users/${OWNER_UID}/sessions/missing/revisions/revision-1`,
    );

    await assertFails(setDoc(reference, TEST_DOCUMENT));
  });

  it("親versionを同時更新しない単独の更新履歴作成を拒否する", async () => {
    const firestore = testEnvironment
      .authenticatedContext(OWNER_UID)
      .firestore();
    const sessionReference = doc(
      firestore,
      `users/${OWNER_UID}/sessions/session-1`,
    );
    const revisionReference = doc(
      firestore,
      `users/${OWNER_UID}/sessions/session-1/revisions/1`,
    );
    const libraryReference = doc(
      firestore,
      `users/${OWNER_UID}/libraries/library-1`,
    );
    await assertSucceeds(
      setDoc(libraryReference, validLibraryDocument(OWNER_UID)),
    );
    await assertSucceeds(
      setDoc(sessionReference, validSessionDocument(OWNER_UID)),
    );
    const sessionSnapshot = await getDoc(sessionReference);

    await assertFails(
      setDoc(
        revisionReference,
        validRevisionDocument(
          "session-1",
          1,
          sessionSnapshot.data() ?? {},
        ),
      ),
    );
  });

  it("対応する更新履歴を同じcommitで作らないセッション更新を拒否する", async () => {
    const firestore = testEnvironment
      .authenticatedContext(OWNER_UID)
      .firestore();
    const libraryReference = doc(
      firestore,
      `users/${OWNER_UID}/libraries/library-1`,
    );
    const sessionReference = doc(
      firestore,
      `users/${OWNER_UID}/sessions/session-1`,
    );

    await assertSucceeds(
      setDoc(libraryReference, validLibraryDocument(OWNER_UID)),
    );
    await assertSucceeds(
      setDoc(sessionReference, validSessionDocument(OWNER_UID)),
    );
    await assertFails(
      setDoc(
        sessionReference,
        {
          note: "履歴なしの変更",
          version: 2,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    );
  });

  it("更新前version由来でないIDや改ざんsnapshotの更新履歴を拒否する", async () => {
    const firestore = testEnvironment
      .authenticatedContext(OWNER_UID)
      .firestore();
    const libraryReference = doc(
      firestore,
      `users/${OWNER_UID}/libraries/library-1`,
    );
    const sessionReference = doc(
      firestore,
      `users/${OWNER_UID}/sessions/session-1`,
    );

    await assertSucceeds(
      setDoc(libraryReference, validLibraryDocument(OWNER_UID)),
    );
    await assertSucceeds(
      setDoc(sessionReference, validSessionDocument(OWNER_UID)),
    );
    const before = (await getDoc(sessionReference)).data() ?? {};

    const wrongIdBatch = writeBatch(firestore);
    wrongIdBatch.set(
      doc(
        firestore,
        `users/${OWNER_UID}/sessions/session-1/revisions/random`,
      ),
      validRevisionDocument("session-1", 1, before),
    );
    wrongIdBatch.update(sessionReference, {
      note: "更新",
      version: 2,
      updatedAt: serverTimestamp(),
    });
    await assertFails(wrongIdBatch.commit());

    const tamperedSnapshotBatch = writeBatch(firestore);
    tamperedSnapshotBatch.set(
      doc(
        firestore,
        `users/${OWNER_UID}/sessions/session-1/revisions/1`,
      ),
      validRevisionDocument("session-1", 1, {
        ...before,
        note: "snapshotを改ざん",
      }),
    );
    tamperedSnapshotBatch.update(sessionReference, {
      note: "更新",
      version: 2,
      updatedAt: serverTimestamp(),
    });
    await assertFails(tamperedSnapshotBatch.commit());

    const wrongFieldsBatch = writeBatch(firestore);
    wrongFieldsBatch.set(
      doc(
        firestore,
        `users/${OWNER_UID}/sessions/session-1/revisions/1`,
      ),
      validRevisionDocument(
        "session-1",
        1,
        before,
        ["anxietyScore"],
      ),
    );
    wrongFieldsBatch.update(sessionReference, {
      note: "更新",
      version: 2,
      updatedAt: serverTimestamp(),
    });
    await assertFails(wrongFieldsBatch.commit());
  });

  it("アーカイブ済み図書館への新規参照を拒否し既存参照の編集は許可する", async () => {
    const firestore = testEnvironment
      .authenticatedContext(OWNER_UID)
      .firestore();
    const firstLibraryReference = doc(
      firestore,
      `users/${OWNER_UID}/libraries/library-1`,
    );
    const secondLibraryReference = doc(
      firestore,
      `users/${OWNER_UID}/libraries/library-2`,
    );
    const sessionReference = doc(
      firestore,
      `users/${OWNER_UID}/sessions/session-1`,
    );

    await assertSucceeds(
      setDoc(firstLibraryReference, validLibraryDocument(OWNER_UID)),
    );
    await assertSucceeds(
      setDoc(secondLibraryReference, validLibraryDocument(OWNER_UID)),
    );
    await assertSucceeds(
      setDoc(sessionReference, validSessionDocument(OWNER_UID)),
    );
    await assertSucceeds(
      setDoc(
        firstLibraryReference,
        {
          archivedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    );

    await assertFails(
      setDoc(
        doc(
          firestore,
          `users/${OWNER_UID}/sessions/session-new`,
        ),
        validSessionDocument(OWNER_UID),
      ),
    );

    const beforeExistingEdit =
      (await getDoc(sessionReference)).data() ?? {};
    const existingEditBatch = writeBatch(firestore);
    existingEditBatch.set(
      doc(
        firestore,
        `users/${OWNER_UID}/sessions/session-1/revisions/1`,
      ),
      validRevisionDocument("session-1", 1, beforeExistingEdit),
    );
    existingEditBatch.update(sessionReference, {
      note: "過去の記録は編集できる",
      version: 2,
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(existingEditBatch.commit());

    await assertSucceeds(
      setDoc(
        secondLibraryReference,
        {
          archivedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    );
    const beforeLibraryChange =
      (await getDoc(sessionReference)).data() ?? {};
    const libraryChangeBatch = writeBatch(firestore);
    libraryChangeBatch.set(
      doc(
        firestore,
        `users/${OWNER_UID}/sessions/session-1/revisions/2`,
      ),
      validRevisionDocument(
        "session-1",
        2,
        beforeLibraryChange,
        ["libraryId"],
      ),
    );
    libraryChangeBatch.update(sessionReference, {
      libraryId: "library-2",
      version: 3,
      updatedAt: serverTimestamp(),
    });
    await assertFails(libraryChangeBatch.commit());
  });

  it("同じlibraryIdを維持する編集でも図書館文書がなければ拒否する", async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(
          context.firestore(),
          `users/${OWNER_UID}/sessions/session-1`,
        ),
        validSessionDocument(OWNER_UID),
      );
    });
    const firestore = testEnvironment
      .authenticatedContext(OWNER_UID)
      .firestore();
    const sessionReference = doc(
      firestore,
      `users/${OWNER_UID}/sessions/session-1`,
    );
    const before = (await getDoc(sessionReference)).data() ?? {};
    const batch = writeBatch(firestore);
    batch.set(
      doc(
        firestore,
        `users/${OWNER_UID}/sessions/session-1/revisions/1`,
      ),
      validRevisionDocument("session-1", 1, before),
    );
    batch.update(sessionReference, {
      note: "参照切れのまま編集",
      version: 2,
      updatedAt: serverTimestamp(),
    });

    await assertFails(batch.commit());
  });

  it("図書館のアーカイブは一方向かつ専用更新に限定し物理削除を拒否する", async () => {
    const firestore = testEnvironment
      .authenticatedContext(OWNER_UID)
      .firestore();
    const libraryReference = doc(
      firestore,
      `users/${OWNER_UID}/libraries/library-1`,
    );

    await assertFails(
      setDoc(libraryReference, {
        ...validLibraryDocument(OWNER_UID),
        archivedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      setDoc(libraryReference, validLibraryDocument(OWNER_UID)),
    );
    await assertSucceeds(
      setDoc(
        libraryReference,
        {
          name: "中央図書館（更新）",
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    );
    await assertFails(
      setDoc(
        libraryReference,
        {
          name: "同時に改名",
          archivedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    );
    await assertSucceeds(
      setDoc(
        libraryReference,
        {
          archivedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    );
    await assertFails(
      setDoc(
        libraryReference,
        {
          archivedAt: deleteField(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    );
    await assertFails(deleteDoc(libraryReference));
  });

  it("所有者フィールドやスコアが不正な文書を拒否する", async () => {
    const firestore = testEnvironment
      .authenticatedContext(OWNER_UID)
      .firestore();
    const libraryReference = doc(
      firestore,
      `users/${OWNER_UID}/libraries/library-1`,
    );
    const sessionReference = doc(
      firestore,
      `users/${OWNER_UID}/sessions/session-1`,
    );

    await assertFails(
      setDoc(libraryReference, validLibraryDocument(OTHER_UID)),
    );
    await assertSucceeds(
      setDoc(libraryReference, validLibraryDocument(OWNER_UID)),
    );
    await assertFails(
      setDoc(sessionReference, {
        ...validSessionDocument(OWNER_UID),
        concentrationScore: 11,
      }),
    );
  });

  it("想定外のトップレベルコレクションへの読み書きを拒否する", async () => {
    const path = "admin/settings";
    await seedDocument(path);
    const firestore = testEnvironment
      .authenticatedContext(OWNER_UID)
      .firestore();
    const reference = doc(firestore, path);

    await assertFails(getDoc(reference));
    await assertFails(setDoc(reference, TEST_DOCUMENT));
  });

  it("users 配下でも想定外のサブコレクションへの読み書きを拒否する", async () => {
    const path = `users/${OWNER_UID}/private/settings`;
    await seedDocument(path);
    const firestore = testEnvironment
      .authenticatedContext(OWNER_UID)
      .firestore();
    const reference = doc(firestore, path);

    await assertFails(getDoc(reference));
    await assertFails(setDoc(reference, TEST_DOCUMENT));
  });
});
