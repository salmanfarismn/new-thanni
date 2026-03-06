# Test Results

**Exit Code:** 1

## Output
```
============================= test session starts =============================
platform win32 -- Python 3.13.12, pytest-9.0.2, pluggy-1.6.0 -- C:\Users\Abinash\AppData\Local\Microsoft\WindowsApps\PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0\python.exe
cachedir: .pytest_cache
rootdir: C:\Users\Abinash\Downloads\ThanniCanuuu\backend
plugins: anyio-4.12.0, asyncio-1.3.0
asyncio: mode=Mode.STRICT, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collecting ... collected 13 items

tests/test_security_upgrade.py::TestLegacyWebhookDeprecation::test_post_whatsapp_webhook_returns_deprecated FAILED [  7%]
tests/test_security_upgrade.py::TestLegacyWebhookDeprecation::test_post_whatsapp_message_returns_deprecated FAILED [ 15%]
tests/test_security_upgrade.py::TestNotificationPreferences::test_get_default_preferences FAILED [ 23%]
tests/test_security_upgrade.py::TestNotificationPreferences::test_update_preferences FAILED [ 30%]
tests/test_security_upgrade.py::TestNotificationPreferences::test_update_preferences_rejects_invalid_fields FAILED [ 38%]
tests/test_security_upgrade.py::TestNotificationPreferences::test_preferences_require_auth FAILED [ 46%]
tests/test_security_upgrade.py::TestNotificationPreferences::test_read_back_updated_preferences FAILED [ 53%]
tests/test_security_upgrade.py::TestCustomerLanguagePreference::test_language_requires_api_key FAILED [ 61%]
tests/test_security_upgrade.py::TestCustomerLanguagePreference::test_language_rejects_unsupported FAILED [ 69%]
tests/test_security_upgrade.py::TestCustomerLanguagePreference::test_language_requires_vendor_id FAILED [ 76%]
tests/test_security_upgrade.py::TestPaymentStatusMapping::test_payment_status_map_includes_delivered_unpaid FAILED [ 84%]
tests/test_security_upgrade.py::TestSecurityDeprecation::test_legacy_handlers_are_deprecated_in_source FAILED [ 92%]
tests/test_security_upgrade.py::TestSecurityDeprecation::test_get_or_create_customer_has_vendor_id_param FAILED [100%]

================================== FAILURES ===================================
_ TestLegacyWebhookDeprecation.test_post_whatsapp_webhook_returns_deprecated __
tests\test_security_upgrade.py:72: in test_post_whatsapp_webhook_returns_deprecated
    assert data["status"] == "deprecated"
E   AssertionError: assert 'ok' == 'deprecated'
E     
E     - deprecated
E     + ok
_ TestLegacyWebhookDeprecation.test_post_whatsapp_message_returns_deprecated __
tests\test_security_upgrade.py:82: in test_post_whatsapp_message_returns_deprecated
    assert resp.status_code == 200
E   assert 422 == 200
E    +  where 422 = <Response [422 Unprocessable Content]>.status_code
__________ TestNotificationPreferences.test_get_default_preferences ___________
tests\test_security_upgrade.py:103: in test_get_default_preferences
    assert resp.status_code == 200
E   assert 404 == 200
E    +  where 404 = <Response [404 Not Found]>.status_code
_____________ TestNotificationPreferences.test_update_preferences _____________
tests\test_security_upgrade.py:120: in test_update_preferences
    assert resp.status_code == 200
E   assert 404 == 200
E    +  where 404 = <Response [404 Not Found]>.status_code
_ TestNotificationPreferences.test_update_preferences_rejects_invalid_fields __
tests\test_security_upgrade.py:135: in test_update_preferences_rejects_invalid_fields
    assert resp.status_code == 400
E   assert 404 == 400
E    +  where 404 = <Response [404 Not Found]>.status_code
__________ TestNotificationPreferences.test_preferences_require_auth __________
tests\test_security_upgrade.py:141: in test_preferences_require_auth
    assert resp.status_code in [401, 403]
E   assert 404 in [401, 403]
E    +  where 404 = <Response [404 Not Found]>.status_code
_______ TestNotificationPreferences.test_read_back_updated_preferences ________
tests\test_security_upgrade.py:158: in test_read_back_updated_preferences
    assert resp.status_code == 200
E   assert 404 == 200
E    +  where 404 = <Response [404 Not Found]>.status_code
________ TestCustomerLanguagePreference.test_language_requires_api_key ________
tests\test_security_upgrade.py:177: in test_language_requires_api_key
    assert resp.status_code in [401, 403, 422]
E   assert 404 in [401, 403, 422]
E    +  where 404 = <Response [404 Not Found]>.status_code
______ TestCustomerLanguagePreference.test_language_rejects_unsupported _______
tests\test_security_upgrade.py:190: in test_language_rejects_unsupported
    assert resp.status_code == 400
E   assert 404 == 400
E    +  where 404 = <Response [404 Not Found]>.status_code
_______ TestCustomerLanguagePreference.test_language_requires_vendor_id _______
tests\test_security_upgrade.py:203: in test_language_requires_vendor_id
    assert resp.status_code == 400
E   assert 404 == 400
E    +  where 404 = <Response [404 Not Found]>.status_code
_ TestPaymentStatusMapping.test_payment_status_map_includes_delivered_unpaid __
tests\test_security_upgrade.py:218: in test_payment_status_map_includes_delivered_unpaid
    agent_source = open(os.path.join(os.path.dirname(__file__), "routers", "agent.py"), "r", encoding="utf-8").read()
                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
E   FileNotFoundError: [Errno 2] No such file or directory: 'C:\\Users\\Abinash\\Downloads\\ThanniCanuuu\\backend\\tests\\routers\\agent.py'
____ TestSecurityDeprecation.test_legacy_handlers_are_deprecated_in_source ____
tests\test_security_upgrade.py:235: in test_legacy_handlers_are_deprecated_in_source
    server_source = open(os.path.join(os.path.dirname(__file__), "server.py"), "r", encoding="utf-8").read()
                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
E   FileNotFoundError: [Errno 2] No such file or directory: 'C:\\Users\\Abinash\\Downloads\\ThanniCanuuu\\backend\\tests\\server.py'
___ TestSecurityDeprecation.test_get_or_create_customer_has_vendor_id_param ___
tests\test_security_upgrade.py:252: in test_get_or_create_customer_has_vendor_id_param
    server_source = open(os.path.join(os.path.dirname(__file__), "server.py"), "r", encoding="utf-8").read()
                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
E   FileNotFoundError: [Errno 2] No such file or directory: 'C:\\Users\\Abinash\\Downloads\\ThanniCanuuu\\backend\\tests\\server.py'
=========================== short test summary info ===========================
FAILED tests/test_security_upgrade.py::TestLegacyWebhookDeprecation::test_post_whatsapp_webhook_returns_deprecated
FAILED tests/test_security_upgrade.py::TestLegacyWebhookDeprecation::test_post_whatsapp_message_returns_deprecated
FAILED tests/test_security_upgrade.py::TestNotificationPreferences::test_get_default_preferences
FAILED tests/test_security_upgrade.py::TestNotificationPreferences::test_update_preferences
FAILED tests/test_security_upgrade.py::TestNotificationPreferences::test_update_preferences_rejects_invalid_fields
FAILED tests/test_security_upgrade.py::TestNotificationPreferences::test_preferences_require_auth
FAILED tests/test_security_upgrade.py::TestNotificationPreferences::test_read_back_updated_preferences
FAILED tests/test_security_upgrade.py::TestCustomerLanguagePreference::test_language_requires_api_key
FAILED tests/test_security_upgrade.py::TestCustomerLanguagePreference::test_language_rejects_unsupported
FAILED tests/test_security_upgrade.py::TestCustomerLanguagePreference::test_language_requires_vendor_id
FAILED tests/test_security_upgrade.py::TestPaymentStatusMapping::test_payment_status_map_includes_delivered_unpaid
FAILED tests/test_security_upgrade.py::TestSecurityDeprecation::test_legacy_handlers_are_deprecated_in_source
FAILED tests/test_security_upgrade.py::TestSecurityDeprecation::test_get_or_create_customer_has_vendor_id_param
============================= 13 failed in 7.31s ==============================
```

