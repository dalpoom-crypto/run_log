import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';

export const useAdminAuth = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      // auth와 db는 사용자의 firebase config에서 import 해야 합니다
      // import { auth, db } from '../config/firebase';
      
      const auth = window.firebaseAuth;
      const db = window.firebaseDb;
      const user = auth.currentUser;
      
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
        
        if (adminDoc.exists()) {
          const data = adminDoc.data();
          setIsAdmin(true);
          setAdminRole(data.role);
          setPermissions(data.permissions || []);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('관리자 권한 확인 실패:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, []);

  const hasPermission = (permission) => {
    return permissions.includes(permission) || adminRole === 'master';
  };

  return { isAdmin, adminRole, permissions, hasPermission, loading };
};
