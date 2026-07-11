# RentPredict Frontend

This folder contains the React + Vite + Tailwind CSS frontend for the existing Flask rent prediction project.

The original Flask templates and static files are still present, so the old UI can continue to run while this frontend is developed.

## Run

From `rentprediction_modified 1`:

```bash
python app.py
```

From `rentprediction_modified 1/frontend`:

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

The Vite dev server proxies `/api`, `/google-login`, and `/static` to Flask on `http://127.0.0.1:5000`.

## Frontend Routes

- `/` - rent prediction form
- `/login` - login with captcha and Google login link
- `/signup` - account creation
- `/result` - predicted rent and rent alert
- `/owner` - owner dashboard
- `/admin` - admin dashboard

