export async function uploadToFolder(
  fileName,
  folderId,
  oauth2Client,
  tpa,
  type,
  content
) {
  // Check if the client is authenticated before proceeding
  if (
    !oauth2Client ||
    !oauth2Client.credentials ||
    !oauth2Client.credentials.access_token
  ) {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/generative-language.retriever',
      ],
    });
    console.log(`Please visit this URL to authorize your app:`);
    console.log(authUrl);
    return;
  }

  // Pass the authenticated client to the Google Drive service
  const service = google.drive({ version: 'v3', auth: oauth2Client });

  const folder = await createOrGetFolder(service, tpa, folderId);

  const fileMetadata = {
    name: fileName,
    parents: [folder],
  };

  if (type === 'csv') {
    const media = {
      mimeType: 'text/csv',
      body: content,
    };

    try {
      const file = await service.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id',
        supportsAllDrives: true,
      });
      console.log(`File ${fileName} created with File Id:`, file.data.id);
      return file.data.id;
    } catch (err) {
      console.error('The API returned an error:', JSON.stringify(err));
      throw err;
    }
  }
}

async function createOrGetFolder(service, folderName, parentFolderId) {
  try {
    // Search for the folder by name and type in the specified parent.
    const response = await service.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents`,
      spaces: 'drive',
      fields: 'files(id, name)',
      supportsAllDrives: true,
    });

    const folders = response.data.files;

    // If the folder is found, return its ID.
    if (folders.length > 0) {
      console.log(
        `Folder found: '${folders[0].name}' with ID: ${folders[0].id}`
      );
      return folders[0].id;
    } else {
      // If the folder is not found, create it.
      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      };
      const newFolder = await service.files.create({
        requestBody: fileMetadata,
        fields: 'id, name',
        supportsAllDrives: true,
      });
      console.log(
        `Folder created: '${newFolder.data.name}' with ID: ${newFolder.data.id}`
      );
      return newFolder.data.id;
    }
  } catch (err) {
    console.error('Error in createOrGetFolder:', JSON.stringify(err));
    throw err;
  }
}
