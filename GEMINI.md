# Project Overview

This is a [Next.js](https://nextjs.org/) project that uses [Convex](https://www.convex.dev/) for its backend and [Clerk](https://clerk.com/) for user authentication. The project is bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

The application displays a list of messages for the currently authenticated user.

## Building and Running

To build and run this project, you will need to have [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed.

1.  **Install dependencies:**

    ```bash
    npm install
    ```

2.  **Run the development server:**

    ```bash
    npm run dev
    ```

    This will start the development server on [http://localhost:3000](http://localhost:3000).

3.  **Build for production:**

    ```bash
    npm run build
    ```

    This will create a production-ready build of the application.

4.  **Start the production server:**

    ```bash
    npm run start
    ```

    This will start the production server.

## Development Conventions

### Authentication

This project uses [Clerk](https://clerk.com/) for user authentication. The authentication is configured in `convex/auth.config.ts` and integrated into the application in `app/layout.tsx`.

### Backend

The backend is built with [Convex](https://www.convex.dev/). The Convex queries are defined in the `convex/` directory. For example, the query to fetch messages for the current user is defined in `convex/messages.ts`.

### Frontend

The frontend is built with [Next.js](https://nextjs.org/) and [React](https://reactjs.org/). The main page of the application is `app/page.tsx`. The layout of the application is defined in `app/layout.tsx`.
Make sure all the colors refer to `globals.css `
Make sure to use shadcn for components.

