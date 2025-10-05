# HelloIT Pros - Client Resources

This repository hosts client-facing documentation and proposals for HelloIT Pros.

## Live Site
Once deployed, your site will be available at: `https://helloitpros.github.io`

## Setup Instructions

### 1. Create the Repository
1. Go to [GitHub](https://github.com/helloitpros) (make sure you're logged into the organization account)
2. Click "New repository"
3. Name it exactly: `helloitpros.github.io`
4. Make it **Public** (required for GitHub Pages)
5. Click "Create repository"

### 2. Upload the Files
You can either use Git or the GitHub web interface:

#### Option A: Using GitHub Web Interface (Easiest)
1. In your new repository, click "uploading an existing file"
2. Drag and drop all three files:
   - `index.html`
   - `gateway-proposal.html`
   - `noonshop-crm-flow.html`
3. Commit the files

#### Option B: Using Git Command Line
```bash
git clone https://github.com/helloitpros/helloitpros.github.io.git
cd helloitpros.github.io
# Copy the three HTML files into this directory
git add .
git commit -m "Initial commit: Add client resources"
git push origin main
```

### 3. Enable GitHub Pages (if not automatic)
1. Go to repository Settings
2. Navigate to "Pages" in the left sidebar
3. Under "Source", select "main" branch
4. Click "Save"

Your site will be live in a few minutes!

## File Structure

```
helloitpros.github.io/
├── index.html              # Landing page with links to resources
├── gateway-proposal.html   # Gateway AI Assistant proposal
└── noonshop-crm-flow.html  # Noonshop CRM journey workflow
```

## Sharing Links with Clients

Once live, you can share these direct links:

- **Gateway Management**: `https://helloitpros.github.io/gateway-proposal.html`
- **Noonshop**: `https://helloitpros.github.io/noonshop-crm-flow.html`
- **Main page**: `https://helloitpros.github.io`

## Updating Content

To update any document:
1. Edit the HTML file
2. Commit and push the changes to the repository
3. GitHub Pages will automatically update the site within a few minutes

## Support

For questions or assistance, contact HelloIT Pros.

---
Last updated: October 5, 2025
