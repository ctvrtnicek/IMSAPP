"""Phase 3E — RMA, Supplier Portal, Document Processor, Repair Portal"""
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'terminal_tracking.db')

def run():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # ReturnOrder: rma_reference
    try: c.execute("ALTER TABLE return_orders ADD COLUMN rma_reference TEXT")
    except: pass

    # RepairReworkOrder: rma_reference
    try: c.execute("ALTER TABLE repair_rework_orders ADD COLUMN rma_reference TEXT")
    except: pass

    # SerialNumber: import_batch_id
    try: c.execute("ALTER TABLE serial_numbers ADD COLUMN import_batch_id INTEGER REFERENCES serial_import_batches(id)")
    except: pass

    # Seed RMA order numbering
    c.execute("SELECT id FROM order_numbering WHERE order_type='RMA'")
    if not c.fetchone():
        c.execute("INSERT INTO order_numbering (order_type, prefix, padding_length, current_sequence) VALUES ('RMA', 'RMA', 6, 0)")

    # Add DOCUMENT_PROCESSOR_PROVIDER system config
    c.execute("SELECT id FROM system_config WHERE config_key='DOCUMENT_PROCESSOR_PROVIDER'")
    if not c.fetchone():
        c.execute("""INSERT INTO system_config (config_key, label, description, data_type, current_value, default_value)
            VALUES ('DOCUMENT_PROCESSOR_PROVIDER', 'Document Processor Provider', 'Provider for document extraction: regex (free, rule-based) or claude_api (requires API key)', 'string', 'regex', 'regex')""")

    c.execute("SELECT id FROM system_config WHERE config_key='AI_DOCUMENT_PROCESSOR_ENABLED'")
    if not c.fetchone():
        c.execute("""INSERT INTO system_config (config_key, label, description, data_type, current_value, default_value)
            VALUES ('AI_DOCUMENT_PROCESSOR_ENABLED', 'Document Processor Enabled', 'Enable AI/OCR document processor for serial import', 'boolean', '1', '1')""")

    conn.commit()
    conn.close()
    print("Phase 3E migration applied.")

if __name__ == "__main__":
    run()
