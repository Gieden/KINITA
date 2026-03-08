<?php
require_once 'db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method == 'POST') {
    $data = json_decode(file_get_contents("php://input"));
    $action = isset($data->action) ? $data->action : '';

    if ($action == 'login') {
        $username = $conn->real_escape_string($data->username);
        $password = $data->password;

        $sql = "SELECT a.Account_ID, a.Password, a.First_Name, a.Last_Name, e.Employee_ID, e.Employee_Role 
                FROM ACCOUNT a 
                JOIN EMPLOYEE e ON a.Account_ID = e.Account_ID 
                WHERE a.Username = '$username'";
        
        $result = $conn->query($sql);

        if ($result->num_rows > 0) {
            $row = $result->fetch_assoc();
            // Verify password
            // Note: For the seeded admin, we might need to handle plain text or hash. 
            // In setup.sql we inserted a fast hash for 'password'.
            if (password_verify($password, $row['Password'])) {
                echo json_encode([
                    "status" => "success",
                    "message" => "Login successful",
                    "user" => [
                        "account_id" => $row['Account_ID'],
                        "employee_id" => $row['Employee_ID'],
                        "first_name" => $row['First_Name'],
                        "last_name" => $row['Last_Name'],
                        "role" => $row['Employee_Role']
                    ]
                ]);
            } else {
                echo json_encode(["status" => "error", "message" => "Invalid password"]);
            }
        } else {
            echo json_encode(["status" => "error", "message" => "User not found"]);
        }
    } elseif ($action == 'register') { // Admin creates new employees
        // This should theoretically be protected
        $username = $conn->real_escape_string($data->username);
        $password = password_hash($data->password, PASSWORD_DEFAULT);
        $firstName = $conn->real_escape_string($data->firstName);
        $lastName = $conn->real_escape_string($data->lastName);
        $contact = $conn->real_escape_string($data->contact);
        $email = isset($data->email) ? $conn->real_escape_string($data->email) : NULL;
        $role = $conn->real_escape_string($data->role); 

        // Transaction to ensure atomicity
        $conn->begin_transaction();

        try {
            $emailVal = $email ? "'$email'" : "NULL";
            $sqlAcc = "INSERT INTO ACCOUNT (Username, Password, First_Name, Last_Name, Email, Contact_Number) 
                       VALUES ('$username', '$password', '$firstName', '$lastName', $emailVal, '$contact')";
            $conn->query($sqlAcc);
            
            $accountId = $conn->insert_id;

            $sqlEmp = "INSERT INTO EMPLOYEE (Account_ID, Employee_Role) 
                       VALUES ($accountId, '$role')";
            $conn->query($sqlEmp);

            $conn->commit();
            echo json_encode(["status" => "success", "message" => "Employee registered successfully"]);
        } catch (Exception $e) {
            $conn->rollback();
            echo json_encode(["status" => "error", "message" => "Registration failed: " . $e->getMessage()]);
        }
    } else {
        echo json_encode(["status" => "error", "message" => "Invalid action"]);
    }
} else {
    echo json_encode(["status" => "error", "message" => "Invalid request method"]);
}

$conn->close();
