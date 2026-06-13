# SplitMate v2 — Release Notes

> Features and enhancements delivered in the v2 development cycle.

---

## 💰 Budgeting System

### Overview
A comprehensive budgeting module enabling personal and group-level financial planning.

### Features
- **Create Budgets** — Personal budgets for individual tracking or Group budgets shared across members
- **Optional Budget Cap** — Set a spending limit to monitor expenses against a target; alerts trigger at 80% usage
- **Income Tracking** — Add income entries to any budget with description, amount, and date
- **Balance Overview** — Real-time view of total income, total spent, and remaining balance per budget
- **Expense Linking** — Manually link existing group expenses to a budget for accurate spend tracking
- **Filter, Sort & Search** — Consolidated filter popover with text search, type/member filters, sort options, and date range
- **View Modes** — Combined (chronological timeline of income + expenses) or Separate (grouped by type)
- **PDF Export** — Export full budget reports including income entries, linked expenses, and balance summary

### Affected Components
- `BudgetView.tsx` — Main budget dashboard with filters, views, and management
- `CreateBudgetDialog.tsx` — Budget creation with type, members, cap, and date selection
- `AddIncomeDialog.tsx` — Income entry with amount, description, and date picker

---

## 🎨 Enhanced UI & User Experience

### Overview
Redesigned interface for a cleaner, more intuitive experience across mobile and desktop.

### Enhancements
- **Streamlined Layout** — Navigation icons moved above summary cards for faster access with reduced scrolling
- **Contextual Card Hiding** — Summary cards (Total Spent / Members) auto-hide when Budget section is active, maximizing screen real estate
- **Responsive Filter Popover** — All filter, sort, and search controls consolidated under a single icon with active filter badge
- **Glass-morphism Cards** — Subtle backdrop blur and transparency for modern card aesthetics
- **Smooth Transitions** — Fade-in animations on section switching for polished navigation feel

---

## 🌗 Dark & Light Mode

### Overview
Full theme support with persistent user preference.

### Features
- **Toggle Switch** — Moon/Sun icon in the header for instant theme switching
- **Persistent Preference** — Selected theme saved to localStorage and restored on return
- **Consistent Theming** — All components, cards, dialogs, and charts respect the active theme via CSS design tokens
- **Semantic Tokens** — HSL-based color system ensures proper contrast in both modes

### Affected Components
- `ThemeProvider.tsx` — Context provider managing theme state and DOM class toggling
- `ThemeToggle.tsx` — Header button for switching between light and dark modes

---

## 🧭 Sidebar Navigation

### Overview
Introduced a slide-out sidebar for comprehensive feature access on all screen sizes.

### Features
- **Hamburger Menu** — Accessible from the header on both mobile and desktop
- **Section Navigation** — Quick links to Expenses, Budget, Charts, Split, and History
- **Action Shortcuts** — Direct access to Add Expense, Export PDF, Members, and Share Settings
- **Group Management** — Close Group option (creator-only) with confirmation dialog
- **Auto-Close** — Sidebar dismisses on navigation for seamless flow

### Affected Components
- `GroupDashboard.tsx` — Sheet-based sidebar with navigation sections and action items

---

## 📊 Budget Charts & Analytics

### Overview
New chart visualizations for deeper financial analysis across budgets.

### Features
- **Budget vs Actual** — Bar charts comparing budget caps against actual spending
- **Income vs Expenses** — Visual breakdown of income and expenditure per budget
- **Group-wise Analysis** — Charts segmented by group budgets for team spending insights
- **Personal Planning** — Individual budget performance charts for personal financial tracking
- **Integrated View** — Charts section in the main dashboard with budget data alongside expense analytics

### Affected Components
- `ExpenseCharts.tsx` — Extended with budget-aware chart panels for income, expenses, and balance analysis

---

## 🤝 Settlements & Settlement History

### Overview
A complete settlement system for resolving group balances with role-based access control.

### Features
- **Smart Settlement Calculation** — Automatic computation of who owes whom and the optimal settlement amounts
- **Settle Up** — One-click settlement recording between members
- **Settlement History** — Full log of past settlements with timestamps and amounts
- **Group-based Access** — Members can only settle their own debts within the group
- **Admin Override** — Group creator (admin) can settle any outstanding balance on behalf of members
- **Activity Logging** — All settlements recorded in the group activity history for transparency

### Affected Components
- `SettlementView.tsx` — Settlement dashboard with balance overview, settle actions, and history
- `GroupDashboard.tsx` — Split section routing and creator-based permission passing

---

## 🗓️ Date Selection for Expenses, Budgets & Income

### Overview
Calendar-based date selection across all financial entry points.

### Features
- **Calendar Date Picker** — Popover-based date selector on Add Expense, Create Budget, and Add Income dialogs
- **Default to Today** — Pre-selects current date but allows past or future dating
- **Edit Mode Support** — Pre-populates calendar with existing date when editing entries
- **Consistent Design** — Uses `react-day-picker` styled to match the app's design system

### Affected Components
- `AddExpenseDialog.tsx` — Date field with calendar picker
- `CreateBudgetDialog.tsx` — Date field with calendar picker
- `AddIncomeDialog.tsx` — Date field with calendar picker

---

## 🔍 Consolidated Budget Filters with Date Range

### Overview
Unified filtering interface replacing scattered filter controls.

### Features
- **Single Filter Icon** — Sliders icon next to "New Budget" opens a responsive popover
- **All Filters in One Panel** — Text search, budget type, member filter, sort options, view mode toggle, and date range
- **Date Range Filtering** — From/To calendar pickers for filtering transactions by date
- **Same-day Filtering** — Selecting identical From and To dates correctly shows all entries for that day
- **Active Filter Badge** — Visual count of currently applied filters on the icon
- **Clear All Filters** — One-click reset for all active filters
- **Responsive Design** — Fully functional on mobile and desktop viewports

### Affected Components
- `BudgetView.tsx` — Complete filter UI overhaul with date range support

---

## Summary of All Changes

| Feature | Type | Description |
|---------|------|-------------|
| Budgeting system | New Feature | Personal & group budgets with income tracking, caps, and balance overview |
| Budget PDF export | New Feature | Export budget reports with income, expenses, and balance |
| Dark & light mode | New Feature | Full theme toggle with persistent preference |
| Sidebar navigation | New Feature | Slide-out menu for feature access and group management |
| Budget charts | New Feature | Income vs expenses and budget vs actual visualizations |
| Settlement system | New Feature | Settle debts with history, group access, and admin override |
| Expense date picker | Enhancement | Calendar-based date selection for adding/editing expenses |
| Budget date picker | Enhancement | Calendar-based date selection for creating/editing budgets |
| Income date picker | Enhancement | Calendar-based date selection for adding/editing income |
| Navigation restructure | UX Improvement | Icon tabs moved above cards for faster access |
| Budget-mode card hiding | UX Improvement | Summary cards hidden in budget view for more space |
| Consolidated filter popover | New Feature | All budget filters in a single responsive popover |
| Date range filtering | New Feature | Filter budget transactions by date range |
| Same-day date filtering | New Feature | From = To date shows all entries for that day |
| Active filter badge | Enhancement | Visual count of applied filters |
| Clear all filters | Enhancement | One-click filter reset |
| Enhanced UI | UX Improvement | Glass-morphism, animations, and responsive layout refinements |
