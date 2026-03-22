## create app and google client id
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Navigate to "APIs & Services" > "Credentials".
4. Click on "Create Credentials" and select "OAuth client ID".
5. Choose "Web application" as the application type.
6. Add authorized JavaScript origins (e.g., `http://localhost:8080`) and authorized redirect URIs (e.g., `http://localhost:8080`).
7. Click "Create" and note down the generated client ID.
8. Add the client ID to your `.env` file as shown in the Build Setup section.


## add test user
1. In the Google Cloud Console, navigate to "APIs & Services" > "OAuth consent screen".
2. Select "External" and click "Create".
3. Fill in the required fields (e.g., App name, User support email, Developer contact information).
4. Save and continue, then add your email address as a test user.
5. Save the changes and you should now be able to authenticate with your Google account when running the app locally.