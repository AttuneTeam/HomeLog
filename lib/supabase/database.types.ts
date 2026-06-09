export type Contractor = {
  id: string;
  name: string;
  abn: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  trade_category: string | null;
  created_at: string;
  updated_at: string;
};

export type UserContractor = {
  id: string;
  user_id: string;
  contractor_id: string;
  notes: string | null;
  created_at: string;
};

export type RenovationSummary = {
  id: string;
  renovation_id: string;
  summary_text: string;
  generated_at: string;
  model_used: string | null;
  is_edited: boolean;
  updated_at: string;
};

export type ExpenseValueSummary = {
  id: string;
  expense_id: string;
  summary_text: string;
  generated_at: string;
  model_used: string | null;
  is_edited: boolean;
  updated_at: string;
};

export type Classification =
  | "repair"
  | "capital_improvement"
  | "initial_repair";

export type RentalExpenseCategory =
  | "water"
  | "council_rates"
  | "insurance"
  | "repairs_maintenance"
  | "strata_fees"
  | "land_tax"
  | "other";

export type RentalOperatingExpense = {
  id: string;
  property_id: string;
  category: RentalExpenseCategory;
  amount: number;
  gst_amount: number | null;
  expense_date: string;
  description: string | null;
  supplier: string | null;
  abn: string | null;
  invoice_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
export type ManualTaxClassification =
  | "Immediate Repair"
  | "Repair"
  | "Capital Works";
export type AiTaxClassification =
  | "Immediate Deduction"
  | "Capital Works (Div 43)"
  | "Plant & Equipment (Div 40)";
export type RenovationStatus = "planned" | "in_progress" | "completed";
export type ExpenseCategory =
  | "labour"
  | "materials"
  | "permits"
  | "professional_fees"
  | "appliances"
  | "fixtures"
  | "other";

export type PropertyEnrichment = {
  id: string;
  property_id: string;
  year_built: number | null;
  architectural_style: string | null;
  heritage_listing: string | null;
  heritage_description: string | null;
  historical_context: string | null;
  notable_features: string[] | null;
  image_urls: string[] | null;
  sale_history: { year: string | null; price: string | null; type: string | null; notes: string | null }[] | null;
  suburb_profile: {
    overview: string | null;
    distance_to_cbd: string | null;
    transport: string[];
    schools: string[];
    parks: string[];
    dining_shopping: string | null;
    lifestyle: string | null;
    median_house_price: string | null;
  } | null;
  street_and_council_history: string | null;
  sources: { title: string; url: string }[] | null;
  raw_search_results: Record<string, unknown> | null;
  enriched_at: string;
  created_at: string;
  updated_at: string;
};

export type PropertyFile = {
  id: string;
  property_id: string;
  storage_path: string;
  display_name: string | null;
  folder_name: string | null;
  created_at: string;
};

export type RentalPeriod = {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string | null;
  weekly_rent: number;
  management_company: string | null;
  agent_name: string | null;
  management_fee_pct: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OffsetAccount = {
  id: string;
  property_id: string;
  label: string;
  balance: number;
  created_at: string;
  updated_at: string;
};

export type AccountMemberRole = "co_owner";
export type AccountMemberStatus = "pending" | "active" | "declined" | "revoked";

export type AccountMember = {
  id: string;
  owner_id: string;
  grantee_email: string;
  grantee_user_id: string | null;
  role: AccountMemberRole;
  status: AccountMemberStatus;
  invite_token: string;
  created_at: string;
  updated_at: string;
};

export type PropertyShareRole = "viewer";
export type PropertyShareStatus = "pending" | "active" | "declined" | "revoked";

export type PropertyShare = {
  id: string;
  property_id: string;
  owner_id: string;
  grantee_email: string;
  grantee_user_id: string | null;
  role: PropertyShareRole;
  status: PropertyShareStatus;
  invite_token: string;
  created_at: string;
  updated_at: string;
};

export type PropertyPassportLink = {
  id: string;
  property_id: string;
  owner_id: string;
  share_token: string;
  expires_at: string | null;
  created_at: string;
};

export type UserStorageUsage = {
  user_id: string;
  total_bytes: number;
  updated_at: string;
};

export interface Database {
  public: {
    Tables: {
      user_storage_usage: {
        Row: {
          user_id: string;
          total_bytes: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          total_bytes?: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          total_bytes?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      property_offset_accounts: {
        Row: {
          id: string;
          property_id: string;
          label: string;
          balance: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          label: string;
          balance?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          label?: string;
          balance?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_offset_accounts_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          financial_year_start_month: number;
          financial_year_start_day: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          financial_year_start_month?: number;
          financial_year_start_day?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          financial_year_start_month?: number;
          financial_year_start_day?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      properties: {
        Row: {
          id: string;
          user_id: string;
          address: string;
          suburb: string | null;
          state: string | null;
          postcode: string | null;
          purchase_date: string | null;
          purchase_price: number | null;
          stamp_duty: number | null;
          property_type: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          address: string;
          suburb?: string | null;
          state?: string | null;
          postcode?: string | null;
          purchase_date?: string | null;
          purchase_price?: number | null;
          stamp_duty?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          address?: string;
          suburb?: string | null;
          state?: string | null;
          postcode?: string | null;
          purchase_date?: string | null;
          purchase_price?: number | null;
          stamp_duty?: number | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "properties_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      renovations: {
        Row: {
          id: string;
          property_id: string;
          name: string;
          description: string | null;
          contractor: string | null;
          start_date: string | null;
          end_date: string | null;
          status: RenovationStatus;
          classification: Classification;
          claimable: boolean | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          name: string;
          description?: string | null;
          contractor?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          status?: RenovationStatus;
          classification: Classification;
          claimable?: boolean | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          contractor?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          status?: RenovationStatus;
          classification?: Classification;
          claimable?: boolean | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "renovations_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      roi_calculator_inputs: {
        Row: {
          user_id: string;
          purchase_price: number | null;
          stamp_duty: number | null;
          legal_fees: number | null;
          capital_growth_rate: number | null;
          weekly_rent: number | null;
          management_fee_rate: number | null;
          council_rates: number | null;
          insurance: number | null;
          maintenance: number | null;
          loan_amount: number | null;
          interest_rate: number | null;
          loan_term: number | null;
          div43_depreciation: number | null;
          div40_depreciation: number | null;
          marginal_tax_rate: number | null;
          annual_household_income: number | null;
          updated_at: string;
          property_id: string;
        };
        Insert: {
          user_id: string;
          property_id?: string;
          purchase_price?: number | null;
          stamp_duty?: number | null;
          legal_fees?: number | null;
          capital_growth_rate?: number | null;
          weekly_rent?: number | null;
          management_fee_rate?: number | null;
          council_rates?: number | null;
          insurance?: number | null;
          maintenance?: number | null;
          loan_amount?: number | null;
          interest_rate?: number | null;
          loan_term?: number | null;
          div43_depreciation?: number | null;
          div40_depreciation?: number | null;
          marginal_tax_rate?: number | null;
          annual_household_income?: number | null;
          updated_at?: string;
        };
        Update: {
          property_id?: string;
          purchase_price?: number | null;
          stamp_duty?: number | null;
          legal_fees?: number | null;
          capital_growth_rate?: number | null;
          weekly_rent?: number | null;
          management_fee_rate?: number | null;
          council_rates?: number | null;
          insurance?: number | null;
          maintenance?: number | null;
          loan_amount?: number | null;
          interest_rate?: number | null;
          loan_term?: number | null;
          div43_depreciation?: number | null;
          div40_depreciation?: number | null;
          marginal_tax_rate?: number | null;
          annual_household_income?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roi_calculator_inputs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          id: string;
          renovation_id: string;
          amount: number;
          category: ExpenseCategory;
          expense_date: string;
          description: string | null;
          supplier: string | null;
          invoice_path: string | null;
          context_notes: string | null;
          manual_classification: ManualTaxClassification | null;
          raw_text: string | null;
          abn: string | null;
          gst_amount: number | null;
          contractor_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          renovation_id: string;
          amount: number;
          category: ExpenseCategory;
          expense_date: string;
          description?: string | null;
          supplier?: string | null;
          invoice_path?: string | null;
          context_notes: string | null;
          manual_classification?: ManualTaxClassification | null;
          raw_text?: string | null;
          abn?: string | null;
          gst_amount?: number | null;
          contractor_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          category?: ExpenseCategory;
          expense_date?: string;
          description?: string | null;
          supplier?: string | null;
          invoice_path?: string | null;
          context_notes?: string | null;
          manual_classification?: ManualTaxClassification | null;
          raw_text?: string | null;
          abn?: string | null;
          gst_amount?: number | null;
          contractor_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_renovation_id_fkey";
            columns: ["renovation_id"];
            isOneToOne: false;
            referencedRelation: "renovations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_contractor_id_fkey";
            columns: ["contractor_id"];
            isOneToOne: false;
            referencedRelation: "contractors";
            referencedColumns: ["id"];
          },
        ];
      };
      ato_rulings_embeddings: {
        Row: {
          id: string;
          ruling_ref: string;
          title: string;
          chunk_index: number;
          chunk_text: string;
          embedding: number[] | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          ruling_ref: string;
          title: string;
          chunk_index?: number;
          chunk_text: string;
          embedding?: number[] | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          ruling_ref?: string;
          title?: string;
          chunk_index?: number;
          chunk_text?: string;
          embedding?: number[] | null;
          metadata?: Record<string, unknown>;
        };
        Relationships: [];
      };
      expense_embeddings: {
        Row: {
          id: string;
          expense_id: string;
          chunk_index: number;
          chunk_text: string;
          embedding: number[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          expense_id: string;
          chunk_index?: number;
          chunk_text: string;
          embedding?: number[] | null;
          created_at?: string;
        };
        Update: {
          chunk_index?: number;
          chunk_text?: string;
          embedding?: number[] | null;
        };
        Relationships: [
          {
            foreignKeyName: "expense_embeddings_expense_id_fkey";
            columns: ["expense_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
        ];
      };
      property_files: {
        Row: {
          id: string;
          property_id: string;
          storage_path: string;
          display_name: string | null;
          folder_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          storage_path: string;
          display_name?: string | null;
          folder_name?: string | null;
          created_at?: string;
        };
        Update: {
          display_name?: string | null;
          folder_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "property_files_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      rental_periods: {
        Row: {
          id: string;
          property_id: string;
          start_date: string;
          end_date: string | null;
          weekly_rent: number;
          management_company: string | null;
          agent_name: string | null;
          management_fee_pct: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          start_date: string;
          end_date?: string | null;
          weekly_rent: number;
          management_company?: string | null;
          agent_name?: string | null;
          management_fee_pct?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          start_date?: string;
          end_date?: string | null;
          weekly_rent?: number;
          management_company?: string | null;
          agent_name?: string | null;
          management_fee_pct?: number | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rental_periods_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      renovation_quotes: {
        Row: {
          id: string;
          renovation_id: string;
          title: string;
          description: string | null;
          total_cost: number | null;
          contractor: string | null;
          file_path: string | null;
          contractor_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          renovation_id: string;
          title: string;
          description?: string | null;
          total_cost?: number | null;
          contractor?: string | null;
          file_path?: string | null;
          contractor_id?: string | null;
          created_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          total_cost?: number | null;
          contractor?: string | null;
          file_path?: string | null;
          contractor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "renovation_quotes_renovation_id_fkey";
            columns: ["renovation_id"];
            isOneToOne: false;
            referencedRelation: "renovations";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_ai_classifications: {
        Row: {
          id: string;
          quote_id: string;
          classification: AiTaxClassification;
          deduction_strategy: string;
          legal_citation: string;
          environmental_flag: boolean;
          confidence_score: number;
          model_used: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quote_id: string;
          classification: AiTaxClassification;
          deduction_strategy: string;
          legal_citation: string;
          environmental_flag?: boolean;
          confidence_score: number;
          model_used?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          classification?: AiTaxClassification;
          deduction_strategy?: string;
          legal_citation?: string;
          environmental_flag?: boolean;
          confidence_score?: number;
          model_used?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quote_ai_classifications_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: true;
            referencedRelation: "renovation_quotes";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_ai_classifications: {
        Row: {
          id: string;
          expense_id: string;
          classification: AiTaxClassification;
          deduction_strategy: string;
          legal_citation: string;
          environmental_flag: boolean;
          confidence_score: number;
          raw_response: Record<string, unknown>;
          model_used: string;
          ato_chunks_used: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          expense_id: string;
          classification: AiTaxClassification;
          deduction_strategy: string;
          legal_citation: string;
          environmental_flag?: boolean;
          confidence_score: number;
          raw_response?: Record<string, unknown>;
          model_used?: string;
          ato_chunks_used?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          classification?: AiTaxClassification;
          deduction_strategy?: string;
          legal_citation?: string;
          environmental_flag?: boolean;
          confidence_score?: number;
          raw_response?: Record<string, unknown>;
          model_used?: string;
          ato_chunks_used?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_ai_classifications_expense_id_fkey";
            columns: ["expense_id"];
            isOneToOne: true;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
        ];
      };
      rental_operating_expenses: {
        Row: {
          id: string;
          property_id: string;
          category: RentalExpenseCategory;
          amount: number;
          gst_amount: number | null;
          expense_date: string;
          description: string | null;
          supplier: string | null;
          abn: string | null;
          invoice_path: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          category: RentalExpenseCategory;
          amount: number;
          gst_amount?: number | null;
          expense_date: string;
          description?: string | null;
          supplier?: string | null;
          abn?: string | null;
          invoice_path?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category?: RentalExpenseCategory;
          amount?: number;
          gst_amount?: number | null;
          expense_date?: string;
          description?: string | null;
          supplier?: string | null;
          abn?: string | null;
          invoice_path?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rental_operating_expenses_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      tax_prepayments: {
        Row: {
          user_id: string;
          financial_year_end: number;
          amount: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          financial_year_end: number;
          amount: number;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      property_loans: {
        Row: {
          property_id: string;
          loan_amount: number;
          loan_term_years: number;
          updated_at: string;
        };
        Insert: {
          property_id: string;
          loan_amount: number;
          loan_term_years: number;
          updated_at?: string;
        };
        Update: {
          loan_amount?: number;
          loan_term_years?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_loans_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: true;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      loan_interest_rates: {
        Row: {
          id: string;
          property_id: string;
          rate: number;
          effective_date: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          rate: number;
          effective_date: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          rate?: number;
          effective_date?: string;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "loan_interest_rates_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      property_enrichment: {
        Row: {
          id: string;
          property_id: string;
          year_built: number | null;
          architectural_style: string | null;
          heritage_listing: string | null;
          heritage_description: string | null;
          historical_context: string | null;
          notable_features: string[] | null;
          image_urls: string[] | null;
          sale_history: { year: string | null; price: string | null; type: string | null; notes: string | null }[] | null;
          suburb_profile: Record<string, unknown> | null;
          street_and_council_history: string | null;
          sources: { title: string; url: string }[] | null;
          raw_search_results: Record<string, unknown> | null;
          enriched_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          year_built?: number | null;
          architectural_style?: string | null;
          heritage_listing?: string | null;
          heritage_description?: string | null;
          historical_context?: string | null;
          notable_features?: string[] | null;
          image_urls?: string[] | null;
          sale_history?: { year: string | null; price: string | null; type: string | null; notes: string | null }[] | null;
          suburb_profile?: Record<string, unknown> | null;
          street_and_council_history?: string | null;
          sources?: { title: string; url: string }[] | null;
          raw_search_results?: Record<string, unknown> | null;
          enriched_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          year_built?: number | null;
          architectural_style?: string | null;
          heritage_listing?: string | null;
          heritage_description?: string | null;
          historical_context?: string | null;
          notable_features?: string[] | null;
          image_urls?: string[] | null;
          sale_history?: { year: string | null; price: string | null; type: string | null; notes: string | null }[] | null;
          suburb_profile?: Record<string, unknown> | null;
          street_and_council_history?: string | null;
          sources?: { title: string; url: string }[] | null;
          raw_search_results?: Record<string, unknown> | null;
          enriched_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_enrichment_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: true;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      household_income_sources: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          amount: number;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label: string;
          amount: number;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          label?: string;
          amount?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "household_income_sources_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      household_expenses: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          amount: number;
          frequency: "monthly" | "quarterly" | "yearly";
          financial_year_end: number;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label: string;
          amount: number;
          frequency?: "monthly" | "quarterly" | "yearly";
          financial_year_end: number;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          label?: string;
          amount?: number;
          frequency?: "monthly" | "quarterly" | "yearly";
          financial_year_end?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "household_expenses_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      account_members: {
        Row: {
          id: string;
          owner_id: string;
          grantee_email: string;
          grantee_user_id: string | null;
          role: AccountMemberRole;
          status: AccountMemberStatus;
          invite_token: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          grantee_email: string;
          grantee_user_id?: string | null;
          role?: AccountMemberRole;
          status?: AccountMemberStatus;
          invite_token?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          grantee_user_id?: string | null;
          status?: AccountMemberStatus;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_members_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      property_shares: {
        Row: {
          id: string;
          property_id: string;
          owner_id: string;
          grantee_email: string;
          grantee_user_id: string | null;
          role: PropertyShareRole;
          status: PropertyShareStatus;
          invite_token: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          owner_id: string;
          grantee_email: string;
          grantee_user_id?: string | null;
          role?: PropertyShareRole;
          status?: PropertyShareStatus;
          invite_token?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          grantee_user_id?: string | null;
          status?: PropertyShareStatus;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_shares_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      property_passport_links: {
        Row: {
          id: string;
          property_id: string;
          owner_id: string;
          share_token: string;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          owner_id: string;
          share_token?: string;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          share_token?: string;
          expires_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "property_passport_links_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: true;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      xero_connections: {
        Row: XeroConnection;
        Insert: {
          id?: string;
          user_id: string;
          tenant_id: string;
          tenant_name?: string | null;
          access_token: string;
          refresh_token: string;
          token_expires_at: string;
          scopes?: string[];
          connected_at?: string;
          updated_at?: string;
        };
        Update: {
          tenant_name?: string | null;
          access_token?: string;
          refresh_token?: string;
          token_expires_at?: string;
          scopes?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      xero_account_mappings: {
        Row: XeroAccountMapping;
        Insert: {
          id?: string;
          user_id: string;
          tenant_id: string;
          home_base_category: string;
          xero_account_code: string;
          xero_account_name?: string | null;
          xero_tracking_category_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          xero_account_code?: string;
          xero_account_name?: string | null;
          xero_tracking_category_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      xero_sync_logs: {
        Row: XeroSyncLog;
        Insert: {
          id?: string;
          user_id: string;
          tenant_id: string;
          property_id?: string | null;
          financial_year: string;
          fy_start: string;
          fy_end: string;
          status?: XeroSyncStatus;
          xero_journal_ids?: string[];
          records_pushed?: number;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          status?: XeroSyncStatus;
          xero_journal_ids?: string[];
          records_pushed?: number;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "xero_sync_logs_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      contractors: {
        Row: Contractor;
        Insert: {
          id?: string;
          name: string;
          abn?: string | null;
          email?: string | null;
          phone?: string | null;
          website?: string | null;
          address?: string | null;
          suburb?: string | null;
          state?: string | null;
          postcode?: string | null;
          trade_category?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          abn?: string | null;
          email?: string | null;
          phone?: string | null;
          website?: string | null;
          address?: string | null;
          suburb?: string | null;
          state?: string | null;
          postcode?: string | null;
          trade_category?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_contractors: {
        Row: UserContractor;
        Insert: {
          id?: string;
          user_id: string;
          contractor_id: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_contractors_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_contractors_contractor_id_fkey";
            columns: ["contractor_id"];
            isOneToOne: false;
            referencedRelation: "contractors";
            referencedColumns: ["id"];
          },
        ];
      };
      renovation_summaries: {
        Row: RenovationSummary;
        Insert: {
          id?: string;
          renovation_id: string;
          summary_text: string;
          generated_at?: string;
          model_used?: string | null;
          is_edited?: boolean;
          updated_at?: string;
        };
        Update: {
          summary_text?: string;
          is_edited?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "renovation_summaries_renovation_id_fkey";
            columns: ["renovation_id"];
            isOneToOne: true;
            referencedRelation: "renovations";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_value_summaries: {
        Row: ExpenseValueSummary;
        Insert: {
          id?: string;
          expense_id: string;
          summary_text: string;
          generated_at?: string;
          model_used?: string | null;
          is_edited?: boolean;
          updated_at?: string;
        };
        Update: {
          summary_text?: string;
          is_edited?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_value_summaries_expense_id_fkey";
            columns: ["expense_id"];
            isOneToOne: true;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      match_ato_rulings: {
        Args: {
          query_embedding: number[];
          match_count?: number;
          match_threshold?: number;
        };
        Returns: {
          id: string;
          ruling_ref: string;
          title: string;
          chunk_text: string;
          similarity: number;
        }[];
      };
    };
    Enums: {
      classification: Classification;
      renovation_status: RenovationStatus;
      expense_category: ExpenseCategory;
      ai_tax_classification: AiTaxClassification;
      rental_expense_category: RentalExpenseCategory;
      xero_sync_status: XeroSyncStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Xero integration types
export type XeroSyncStatus = "pending" | "in_progress" | "completed" | "failed";

export type XeroConnection = {
  id: string;
  user_id: string;
  tenant_id: string;
  tenant_name: string | null;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  scopes: string[];
  connected_at: string;
  updated_at: string;
};

export type XeroAccountMapping = {
  id: string;
  user_id: string;
  tenant_id: string;
  home_base_category: string;
  xero_account_code: string;
  xero_account_name: string | null;
  xero_tracking_category_id: string | null;
  created_at: string;
  updated_at: string;
};

export type XeroSyncLog = {
  id: string;
  user_id: string;
  tenant_id: string;
  property_id: string | null;
  financial_year: string;
  fy_start: string;
  fy_end: string;
  status: XeroSyncStatus;
  xero_journal_ids: string[];
  records_pushed: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};
