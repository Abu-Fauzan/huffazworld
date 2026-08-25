const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');

const {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
} = require('firebase/firestore');

const fs = require('fs');

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'huffazworld',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

function ownerDb() {
  return testEnv.authenticatedContext('owner-user').firestore();
}

function otherDb() {
  return testEnv.authenticatedContext('other-user').firestore();
}

function anonymousDb() {
  return testEnv.unauthenticatedContext().firestore();
}

function validPost(uid = 'owner-user') {
  return {
    uid,
    text: 'Security test post',
    authorName: 'Test Owner',
    authorRole: 'Member',
    authorCountry: 'Nigeria',
    authorPhoto: '',
    createdAt: '2026-08-25T10:00:00.000Z',
  };
}

describe('HuffazWorld Posts Security Rules', () => {

  test('Owner can create their own post', async () => {
    const db = ownerDb();

    await assertSucceeds(
      setDoc(doc(db, 'posts', 'post-owner'), validPost('owner-user'))
    );
  });

  test('User cannot create a post claiming another UID', async () => {
    const db = otherDb();

    await assertFails(
      setDoc(doc(db, 'posts', 'post-forged'), validPost('owner-user'))
    );
  });

  test('Authenticated user can read a post', async () => {
    const owner = ownerDb();

    await assertSucceeds(
      setDoc(doc(owner, 'posts', 'post-read'), validPost())
    );

    const other = otherDb();

    await assertSucceeds(
      getDoc(doc(other, 'posts', 'post-read'))
    );
  });

  test('Unauthenticated user cannot read a post', async () => {
    const owner = ownerDb();

    await assertSucceeds(
      setDoc(doc(owner, 'posts', 'post-private-read'), validPost())
    );

    const anonymous = anonymousDb();

    await assertFails(
      getDoc(doc(anonymous, 'posts', 'post-private-read'))
    );
  });

  test('Owner can edit their own post', async () => {
    const db = ownerDb();

    await assertSucceeds(
      setDoc(doc(db, 'posts', 'post-edit'), validPost())
    );

    await assertSucceeds(
      updateDoc(doc(db, 'posts', 'post-edit'), {
        text: 'Updated security test post',
        edited: true,
      })
    );
  });

  test('Other user cannot edit someone else post', async () => {
    const owner = ownerDb();

    await assertSucceeds(
      setDoc(doc(owner, 'posts', 'post-no-edit'), validPost())
    );

    const other = otherDb();

    await assertFails(
      updateDoc(doc(other, 'posts', 'post-no-edit'), {
        text: 'Malicious edit',
        edited: true,
      })
    );
  });

  test('Owner can delete their own post', async () => {
    const db = ownerDb();

    await assertSucceeds(
      setDoc(doc(db, 'posts', 'post-delete'), validPost())
    );

    await assertSucceeds(
      deleteDoc(doc(db, 'posts', 'post-delete'))
    );
  });

  test('Other user cannot delete someone else post', async () => {
    const owner = ownerDb();

    await assertSucceeds(
      setDoc(doc(owner, 'posts', 'post-no-delete'), validPost())
    );

    const other = otherDb();

    await assertFails(
      deleteDoc(doc(other, 'posts', 'post-no-delete'))
    );
  });

});

test('Current rules reject adding a like through the post array', async () => {
  const owner = ownerDb();

  await assertSucceeds(
    setDoc(doc(owner, 'posts', 'post-like-test'), {
      ...validPost(),
      likes: [],
    })
  );

  const other = otherDb();

  await assertFails(
    updateDoc(doc(other, 'posts', 'post-like-test'), {
      likes: ['other-user'],
    })
  );
});

test('Current rules reject adding a comment through the post array', async () => {
  const owner = ownerDb();

  await assertSucceeds(
    setDoc(doc(owner, 'posts', 'post-comment-test'), {
      ...validPost(),
      comments: [],
    })
  );

  const other = otherDb();

  await assertFails(
    updateDoc(doc(other, 'posts', 'post-comment-test'), {
      comments: [{
        id: 'comment-1',
        uid: 'other-user',
        name: 'Other User',
        text: 'Test comment',
        createdAt: '2026-08-25T10:00:00.000Z',
      }],
    })
  );
});


test('Authenticated user can create their own post like', async () => {
  const owner = ownerDb();

  await assertSucceeds(
    setDoc(doc(owner, 'posts', 'post-like-owner'), validPost())
  );

  const other = otherDb();

  await assertSucceeds(
    setDoc(
      doc(other, 'posts', 'post-like-owner', 'likes', 'other-user'),
      {
        uid: 'other-user',
        createdAt: '2026-08-25T10:00:00.000Z',
      }
    )
  );
});

test('User cannot create a like pretending to be another user', async () => {
  const owner = ownerDb();

  await assertSucceeds(
    setDoc(doc(owner, 'posts', 'post-like-forged'), validPost())
  );

  const other = otherDb();

  await assertFails(
    setDoc(
      doc(other, 'posts', 'post-like-forged', 'likes', 'owner-user'),
      {
        uid: 'owner-user',
        createdAt: '2026-08-25T10:00:00.000Z',
      }
    )
  );
});

test('User can delete their own post like', async () => {
  const owner = ownerDb();

  await assertSucceeds(
    setDoc(doc(owner, 'posts', 'post-like-delete'), validPost())
  );

  const other = otherDb();

  const likeRef = doc(
    other,
    'posts',
    'post-like-delete',
    'likes',
    'other-user'
  );

  await assertSucceeds(
    setDoc(likeRef, {
      uid: 'other-user',
      createdAt: '2026-08-25T10:00:00.000Z',
    })
  );

  await assertSucceeds(deleteDoc(likeRef));
});

test('User cannot delete another user post like', async () => {
  const owner = ownerDb();

  await assertSucceeds(
    setDoc(doc(owner, 'posts', 'post-like-protected'), validPost())
  );

  const ownerLike = doc(
    owner,
    'posts',
    'post-like-protected',
    'likes',
    'owner-user'
  );

  await assertSucceeds(
    setDoc(ownerLike, {
      uid: 'owner-user',
      createdAt: '2026-08-25T10:00:00.000Z',
    })
  );

  const other = otherDb();

  const otherLike = doc(
    other,
    'posts',
    'post-like-protected',
    'likes',
    'owner-user'
  );

  await assertFails(deleteDoc(otherLike));
});

describe('HuffazWorld Post Comments Security Rules', () => {

  test('Authenticated user can create their own post comment', async () => {
    const owner = ownerDb();

    await assertSucceeds(
      setDoc(
        doc(owner, 'posts', 'post-comment-create', 'comments', 'owner-comment'),
        {
          uid: 'owner-user',
          name: 'Test Owner',
          text: 'My security test comment',
          createdAt: '2026-08-25T10:00:00.000Z',
        }
      )
    );
  });

  test('User cannot create a comment pretending to be another user', async () => {
    const owner = ownerDb();

    await assertSucceeds(
      setDoc(
        doc(owner, 'posts', 'post-comment-forged', 'comments', 'owner-comment'),
        {
          uid: 'owner-user',
          name: 'Test Owner',
          text: 'Owner comment',
          createdAt: '2026-08-25T10:00:00.000Z',
        }
      )
    );

    const other = otherDb();

    await assertFails(
      setDoc(
        doc(other, 'posts', 'post-comment-forged', 'comments', 'owner-comment'),
        {
          uid: 'owner-user',
          name: 'Test Owner',
          text: 'Forged comment',
          createdAt: '2026-08-25T10:00:00.000Z',
        }
      )
    );
  });

  test('Unauthenticated user cannot create a post comment', async () => {
    const owner = ownerDb();

    await assertSucceeds(
      setDoc(
        doc(owner, 'posts', 'post-comment-anonymous', 'comments', 'comment-1'),
        {
          uid: 'owner-user',
          name: 'Test Owner',
          text: 'Owner comment',
          createdAt: '2026-08-25T10:00:00.000Z',
        }
      )
    );

    const anonymous = anonymousDb();

    await assertFails(
      setDoc(
        doc(
          anonymous,
          'posts',
          'post-comment-anonymous',
          'comments',
          'anonymous-comment'
        ),
        {
          uid: 'anonymous',
          name: 'Anonymous',
          text: 'Anonymous comment',
          createdAt: '2026-08-25T10:00:00.000Z',
        }
      )
    );
  });

  test('User can edit their own post comment', async () => {
    const owner = ownerDb();

    const commentRef = doc(
      owner,
      'posts',
      'post-comment-edit',
      'comments',
      'owner-comment'
    );

    await assertSucceeds(
      setDoc(commentRef, {
        uid: 'owner-user',
        name: 'Test Owner',
        text: 'Original comment',
        createdAt: '2026-08-25T10:00:00.000Z',
      })
    );

    await assertSucceeds(
      updateDoc(commentRef, {
        text: 'Edited comment',
        editedAt: '2026-08-25T11:00:00.000Z',
      })
    );
  });

  test('User cannot edit another user post comment', async () => {
    const owner = ownerDb();

    const commentRef = doc(
      owner,
      'posts',
      'post-comment-edit-protected',
      'comments',
      'owner-comment'
    );

    await assertSucceeds(
      setDoc(commentRef, {
        uid: 'owner-user',
        name: 'Test Owner',
        text: 'Original comment',
        createdAt: '2026-08-25T10:00:00.000Z',
      })
    );

    const other = otherDb();

    await assertFails(
      updateDoc(
        doc(
          other,
          'posts',
          'post-comment-edit-protected',
          'comments',
          'owner-comment'
        ),
        {
          text: 'Unauthorized edit',
          editedAt: '2026-08-25T11:00:00.000Z',
        }
      )
    );
  });

  test('User can delete their own post comment', async () => {
    const owner = ownerDb();

    const commentRef = doc(
      owner,
      'posts',
      'post-comment-delete',
      'comments',
      'owner-comment'
    );

    await assertSucceeds(
      setDoc(commentRef, {
        uid: 'owner-user',
        name: 'Test Owner',
        text: 'Comment to delete',
        createdAt: '2026-08-25T10:00:00.000Z',
      })
    );

    await assertSucceeds(deleteDoc(commentRef));
  });

  test('User cannot delete another user post comment', async () => {
    const owner = ownerDb();

    const commentRef = doc(
      owner,
      'posts',
      'post-comment-delete-protected',
      'comments',
      'owner-comment'
    );

    await assertSucceeds(
      setDoc(commentRef, {
        uid: 'owner-user',
        name: 'Test Owner',
        text: 'Protected comment',
        createdAt: '2026-08-25T10:00:00.000Z',
      })
    );

    const other = otherDb();

    await assertFails(
      deleteDoc(
        doc(
          other,
          'posts',
          'post-comment-delete-protected',
          'comments',
          'owner-comment'
        )
      )
    );
  });

});
